package main

import (
	"backend/handler"
	"backend/middleware"
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := ":" + port
	r := http.NewServeMux()
	r.HandleFunc("GET /courses", handler.CourseHandler)
	r.HandleFunc("GET /download", handler.DownloadHandler)
	r.HandleFunc("GET /papers", handler.PapersHandler)
	r.HandleFunc("POST /upload", handler.UploadHandler)

	fmt.Printf("Starting server on :%s\n", port)
	log.Fatal(http.ListenAndServe(addr, middleware.CORSMiddleware(r)))
}
