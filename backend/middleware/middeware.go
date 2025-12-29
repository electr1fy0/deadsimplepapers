package middleware

import (
	"net/http"
)

var allowedOrigins = map[string]bool{
	"https://papers.ayushpandey.xyz":      true,
	"https://vitpapers.vercel.app":        true,
	"https://deadsimplepapers.vercel.app": true,
	// "http://localhost:3000":               true,
}

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("origin")

		if allowedOrigins[origin] {
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, apiKey")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
