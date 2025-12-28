package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"
)

const (
	coursesRequestTimeout = 10 * time.Second
)

func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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

type supabaseConfig struct {
	URL string
	Key string
}

func loadSupabaseConfig() (supabaseConfig, error) {
	url := os.Getenv("SUPABASE_REST_URL")
	key := os.Getenv("SUPABASE_PUBLISHABLE_KEY")
	if url == "" || key == "" {
		return supabaseConfig{}, fmt.Errorf("server misconfiguration: missing Supabase creds")
	}
	return supabaseConfig{URL: url, Key: key}, nil
}

type courseResponse struct {
	Course string `json:"course_title"`
}

func fetchCourses(config supabaseConfig) ([]string, error) {
	url := fmt.Sprintf("%s/rest/v1/papers?select=course_title", config.URL)

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

	var results []courseResponse
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("decoding failed: %w", err)
	}
	courseSet := make(map[string]bool)
	var uniqueCourses []string

	for _, c := range results {
		if strings.TrimSpace(c.Course) != "" && !courseSet[c.Course] {
			courseSet[c.Course] = true
			uniqueCourses = append(uniqueCourses, c.Course)
		}
	}

	slices.Sort(uniqueCourses)
	return uniqueCourses, nil
}
