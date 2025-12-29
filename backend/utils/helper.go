package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"
)

const (
	coursesRequestTimeout  = 10 * time.Second
	uploadTimeout          = 60 * time.Second
	downloadRequestTimeout = 10 * time.Second
	papersRequestTimeout   = 10 * time.Second
	signedURLExpirySeconds = 3600
)

type SuccessResponse struct {
	Success  bool   `json:"success"`
	Filename string `json:"filename"`
	Message  string `json:"message"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

func SendError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{Success: false, Error: message})
}

func UploadToStorage(config SupabaseConfig, filename string, data []byte) error {
	url := fmt.Sprintf("%s/storage/v1/object/papers/%s", config.URL, filename)

	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+config.Key)
	req.Header.Set("apikey", config.Key)
	req.Header.Set("Content-Type", "application/pdf")

	client := &http.Client{Timeout: uploadTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("storage error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func SaveToDatabase(config SupabaseConfig, meta paperMetadata, filename string) error {
	url := fmt.Sprintf("%s/rest/v1/papers", config.URL)

	payload := map[string]any{
		"course_title":  meta.CourseTitle,
		"course_code":   meta.CourseCode,
		"semester_name": meta.SemesterName,
		"year":          meta.Year,
		"exam_type":     meta.ExamType,
		"slot":          meta.Slot,
		"filename":      filename,
		"is_valid":      false,
	}

	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+config.Key)
	req.Header.Set("apikey", config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: uploadTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("database error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func BuildSupabaseQueryURL(baseURL string, params url.Values) (string, error) {
	postgrestURL := fmt.Sprintf("%s/rest/v1/papers?select=*", baseURL)
	queryParams := []string{"order=semester_name.desc"}

	if course := params.Get("course_title"); course != "" {
		safeCourse := strings.ReplaceAll(url.PathEscape(course), "%2A", "*")
		queryParams = append(queryParams, fmt.Sprintf("course_title=ilike.*%s*", safeCourse))
	}

	if semesterName := params.Get("semester_name"); semesterName != "" {
		queryParams = append(queryParams, fmt.Sprintf("semester_name=eq.%s", url.QueryEscape(semesterName)))
	}

	if year := params.Get("year"); year != "" {
		queryParams = append(queryParams, fmt.Sprintf("year=eq.%s", url.QueryEscape(year)))
	}
	if t := params.Get("exam_type"); t != "" {
		queryParams = append(queryParams, fmt.Sprintf("exam_type=eq.%s", url.QueryEscape(t)))
	}

	if slot := params.Get("slot"); slot != "" {
		queryParams = append(queryParams, fmt.Sprintf("slot=eq.%s", url.QueryEscape(slot)))
	}

	return postgrestURL + "&" + strings.Join(queryParams, "&"), nil
}

func ProxyToSupabase(w http.ResponseWriter, config SupabaseConfig, url string) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", config.Key)

	client := &http.Client{Timeout: papersRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)

	if _, err := io.Copy(w, resp.Body); err != nil {
		return fmt.Errorf("failed to write response: %w", err)
	}

	return nil
}

func GetSignedURL(config SupabaseConfig, filename string) (string, error) {
	signAPIURL := fmt.Sprintf("%s/storage/v1/object/sign/papers/%s", config.URL, filename)

	payload, _ := json.Marshal(signRequest{ExpiresIn: signedURLExpirySeconds})

	req, err := http.NewRequest("POST", signAPIURL, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+config.Key)
	req.Header.Set("apikey", config.Key)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: downloadRequestTimeout}
	resp, err := client.Do(req)

	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("signing failed with status: %d", resp.StatusCode)
	}

	var result signResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return fmt.Sprintf("%s/storage/v1%s", config.URL, result.SignedURL), nil
}

func FetchCourses(config SupabaseConfig) ([]CourseInfo, error) {
	url := fmt.Sprintf("%s/rest/v1/papers?select=course_title,course_code&is_valid=eq.true", config.URL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", config.Key)

	client := &http.Client{Timeout: coursesRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase error code: %d", resp.StatusCode)
	}

	var results []paperRecord
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("decoding failed: %w", err)
	}

	courseMap := make(map[string]*CourseInfo)
	var order []string

	for _, p := range results {
		title := strings.TrimSpace(p.CourseTitle)
		if title == "" {
			continue
		}

		if existing, ok := courseMap[title]; ok {
			existing.PaperCount++
			if existing.Code == "" && p.CourseCode != "" {
				existing.Code = p.CourseCode
			}
		} else {
			courseMap[title] = &CourseInfo{
				Title:      title,
				Code:       strings.TrimSpace(p.CourseCode),
				PaperCount: 1,
			}
			order = append(order, title)
		}
	}

	slices.Sort(order)

	courses := make([]CourseInfo, 0, len(order))
	for _, title := range order {
		courses = append(courses, *courseMap[title])
	}

	return courses, nil
}
