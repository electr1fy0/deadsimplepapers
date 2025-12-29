package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"
)

const (
	coursesRequestTimeout = 10 * time.Second
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

type PapersClient struct {
	Client *http.Client
}

func courseHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
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
func main() {
	r := http.NewServeMux()

	r.HandleFunc("GET /api/courses", courseHandler)

	fmt.Println("Starting server on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))

}
