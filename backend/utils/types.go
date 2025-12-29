package utils

type CourseInfo struct {
	Title      string `json:"course_title"`
	Code       string `json:"course_code"`
	PaperCount int    `json:"paper_count"`
}

type paperRecord struct {
	CourseTitle string `json:"course_title"`
	CourseCode  string `json:"course_code"`
}

type signRequest struct {
	ExpiresIn int `json:"expiresIn"`
}

type signResponse struct {
	SignedURL string `json:"signedURL"`
}
