package utils

import (
	"fmt"
	"os"
)

type SupabaseConfig struct {
	URL string
	Key string
}

func LoadSupabaseConfig() (SupabaseConfig, error) {
	url := os.Getenv("SUPABASE_REST_URL")
	key := os.Getenv("SUPABASE_PUBLISHABLE_KEY")
	if url == "" || key == "" {
		return SupabaseConfig{}, fmt.Errorf("server misconfiguration: missing Supabase creds")
	}
	return SupabaseConfig{URL: url, Key: key}, nil
}
