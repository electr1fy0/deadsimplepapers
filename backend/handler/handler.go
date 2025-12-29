package handler

import (
	"backend/utils"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"time"
)

const (
	maxFileSize = 10 << 20
)

func CourseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	config, err := utils.LoadSupabaseConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	courses, err := utils.FetchCourses(config)
	if err != nil {
		http.Error(w, "Failed to fetch courses: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(courses)
}

func PapersHandler(w http.ResponseWriter, r *http.Request) {

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	config, err := utils.LoadSupabaseConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	supabaseURL, err := utils.BuildSupabaseQueryURL(config.URL, r.URL.Query())
	if err != nil {
		http.Error(w, "Invalid query parameters", http.StatusBadRequest)
		return
	}

	if err := utils.ProxyToSupabase(w, config, supabaseURL); err != nil {
		http.Error(w, "Request failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

func DownloadHandler(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("filename")
	if filename == "" {
		http.Error(w, "Missing filename parameter", http.StatusBadRequest)
		return
	}

	config, err := utils.LoadSupabaseConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	redirectURL, err := utils.GetSignedURL(config, filename)
	if err != nil {
		http.Error(w, "error getting signed supabase url", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func UploadHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		utils.SendError(w, "File too large or invalid format", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		utils.SendError(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	meta := utils.ExtractMetadata(r)
	if err := meta.Validate(); err != nil {
		utils.SendError(w, err.Error(), http.StatusBadRequest)
		return
	}

	config, err := utils.LoadSupabaseConfig()
	if err != nil {
		utils.SendError(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		utils.SendError(w, "Error reading file", http.StatusInternalServerError)
		return
	}

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".pdf"
	}
	filename := fmt.Sprintf("%d-paper%s", time.Now().UnixNano(), ext)

	if err := utils.UploadToStorage(config, filename, fileBytes); err != nil {
		utils.SendError(w, "Failed to upload file", http.StatusInternalServerError)
		return
	}

	if err := utils.SaveToDatabase(config, meta, filename); err != nil {
		utils.SendError(w, "Failed to save paper metadata", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessResponse{
		Success:  true,
		Filename: filename,
		Message:  "Paper uploaded! It will be reviewed before appearing.",
	})
}
