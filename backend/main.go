package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

const (
	coursesRequestTimeout = 10 * time.Second
	origin                = "https://deadsimplepapers.vercel.app"
)

type CourseInfo struct {
	Title      string `json:"course_title"`
	Code       string `json:"course_code"`
	PaperCount int    `json:"paper_count"`
}

type supabaseConfig struct {
	URL string
	Key string
}

type paperRecord struct {
	CourseTitle string `json:"course_title"`
	CourseCode  string `json:"course_code"`
}

func loadSupabaseConfig() (supabaseConfig, error) {
	url := os.Getenv("SUPABASE_REST_URL")
	key := os.Getenv("SUPABASE_PUBLISHABLE_KEY")
	if url == "" || key == "" {
		return supabaseConfig{}, fmt.Errorf("server misconfiguration: missing Supabase creds")
	}
	return supabaseConfig{URL: url, Key: key}, nil
}

func fetchCourses(config supabaseConfig) ([]CourseInfo, error) {
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

func courseHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	config, err := loadSupabaseConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	courses, err := fetchCourses(config)
	if err != nil {
		http.Error(w, "Failed to fetch courses: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(courses)
}

const (
	maxFileSize   = 10 << 20
	uploadTimeout = 60 * time.Second
)

type errorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type successResponse struct {
	Success  bool   `json:"success"`
	Filename string `json:"filename"`
	Message  string `json:"message"`
}

func sendError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(errorResponse{Success: false, Error: message})
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey")
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		sendError(w, "File too large or invalid format", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		sendError(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	meta := extractMetadata(r)
	if err := meta.validate(); err != nil {
		sendError(w, err.Error(), http.StatusBadRequest)
		return
	}

	config, err := loadSupabaseConfig()
	if err != nil {
		sendError(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		sendError(w, "Error reading file", http.StatusInternalServerError)
		return
	}

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".pdf"
	}
	filename := fmt.Sprintf("%d-paper%s", time.Now().UnixNano(), ext)

	if err := uploadToStorage(config, filename, fileBytes); err != nil {
		sendError(w, "Failed to upload file", http.StatusInternalServerError)
		return
	}

	if err := saveToDatabase(config, meta, filename); err != nil {
		sendError(w, "Failed to save paper metadata", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(successResponse{
		Success:  true,
		Filename: filename,
		Message:  "Paper uploaded! It will be reviewed before appearing.",
	})
}

type paperMetadata struct {
	Course       string
	Code         string
	SemesterName string
	ExamType     string
	Slot         string
}

func extractMetadata(r *http.Request) paperMetadata {
	return paperMetadata{
		Course:       strings.TrimSpace(r.FormValue("course")),
		Code:         strings.TrimSpace(r.FormValue("code")),
		SemesterName: strings.TrimSpace(r.FormValue("semester_name")),
		ExamType:     strings.TrimSpace(r.FormValue("type")),
		Slot:         strings.TrimSpace(r.FormValue("slot")),
	}
}

func (m paperMetadata) validate() error {
	if m.Course == "" {
		return fmt.Errorf("course name is required")
	}
	return nil
}

func uploadToStorage(config supabaseConfig, filename string, data []byte) error {
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

func saveToDatabase(config supabaseConfig, meta paperMetadata, filename string) error {
	url := fmt.Sprintf("%s/rest/v1/papers", config.URL)

	payload := map[string]interface{}{
		"course_title":      meta.Course,
		"course_code":       meta.Code,
		"semester_name":     meta.SemesterName,
		"type":              meta.ExamType,
		"slot":              meta.Slot,
		"filename":          filename,
		"is_valid":          false,
		"validation_reason": "Pending manual review",
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

const (
	papersRequestTimeout = 10 * time.Second
)

func papersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	config, err := loadSupabaseConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	supabaseURL, err := buildSupabaseQueryURL(config.URL, r.URL.Query())
	if err != nil {
		http.Error(w, "Invalid query parameters", http.StatusBadRequest)
		return
	}

	if err := proxyToSupabase(w, config, supabaseURL); err != nil {
		http.Error(w, "Request failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

func buildSupabaseQueryURL(baseURL string, params url.Values) (string, error) {
	postgrestURL := fmt.Sprintf("%s/rest/v1/papers?select=*", baseURL)
	queryParams := []string{"order=semester_name.desc"}

	if course := params.Get("course_title"); course != "" {
		safeCourse := strings.ReplaceAll(url.PathEscape(course), "%2A", "*")
		queryParams = append(queryParams, fmt.Sprintf("course_title=ilike.*%s*", safeCourse))
	}

	if semesterName := params.Get("semester_name"); semesterName != "" {
		queryParams = append(queryParams, fmt.Sprintf("semester_name=eq.%s", url.QueryEscape(semesterName)))
	}

	if t := params.Get("type"); t != "" {
		queryParams = append(queryParams, fmt.Sprintf("type=eq.%s", url.QueryEscape(t)))
	}

	if slot := params.Get("slot"); slot != "" {
		queryParams = append(queryParams, fmt.Sprintf("slot=eq.%s", url.QueryEscape(slot)))
	}

	return postgrestURL + "&" + strings.Join(queryParams, "&"), nil
}

func proxyToSupabase(w http.ResponseWriter, config supabaseConfig, url string) error {
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

const (
	downloadRequestTimeout = 10 * time.Second
	signedURLExpirySeconds = 3600
)

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey")
	filename := r.URL.Query().Get("filename")
	if filename == "" {
		http.Error(w, "Missing filename parameter", http.StatusBadRequest)
		return
	}

	config, err := loadSupabaseConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	redirectURL, err := getSignedURL(config, filename)
	if err != nil {
		http.Error(w, "error getting signed supabase url", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

type signRequest struct {
	ExpiresIn int `json:"expiresIn"`
}

type signResponse struct {
	SignedURL string `json:"signedURL"`
}

func getSignedURL(config supabaseConfig, filename string) (string, error) {
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

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := ":" + port
	r := http.NewServeMux()
	r.HandleFunc("OPTIONS /courses", courseHandler)
	r.HandleFunc("OPTIONS /papers", papersHandler)
	r.HandleFunc("OPTIONS /upload", uploadHandler)
	r.HandleFunc("GET /courses", courseHandler)
	r.HandleFunc("GET /download", downloadHandler)
	r.HandleFunc("GET /papers", papersHandler)
	r.HandleFunc("POST /upload", uploadHandler)

	fmt.Printf("Starting server on :%s\n", port)
	log.Fatal(http.ListenAndServe(addr, r))

}
