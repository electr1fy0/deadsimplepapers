package utils

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

type paperMetadata struct {
	CourseTitle  string
	CourseCode   string
	SemesterName string
	Year         int
	ExamType     string
	Slot         string
}

func ExtractMetadata(r *http.Request) paperMetadata {
	year, _ := strconv.Atoi(strings.TrimSpace(r.FormValue("year")))
	return paperMetadata{
		CourseTitle: strings.TrimSpace(r.FormValue("course_title")),

		CourseCode:   strings.TrimSpace(r.FormValue("course_code")),
		SemesterName: strings.TrimSpace(r.FormValue("semester_name")),
		Year:         year,
		ExamType:     strings.TrimSpace(r.FormValue("exam_type")),
		Slot:         strings.TrimSpace(r.FormValue("slot")),
	}
}

func (m paperMetadata) Validate() error {
	if m.CourseTitle == "" {
		return fmt.Errorf("course name is required")
	}
	return nil
}
