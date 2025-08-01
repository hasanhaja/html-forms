package main

import (
	"encoding/json"
	"log"
	"net/http"
)

type ValidResponse struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
}

func validateGet(w http.ResponseWriter, req *http.Request) {
	// TODO read query params
	query := req.URL.Query()
	field := query.Get("field")
	value := query.Get("value")

	if field == "" || value == "" {
		NotFoundErrorHandler(w, req)
		return
	}

	var res ValidResponse

	switch field {
	case "last-name":
		if value != "Bloggs" {
			res = ValidResponse{
				Valid:   false,
				Message: "Enter 'Bloggs'",
			}
		} else {
			res = ValidResponse{
				Valid:   true,
				Message: "OK",
			}
		}
	default:
		res = ValidResponse{
			Valid:   true,
			Message: "OK",
		}
	}

	jsonBytes, err := json.Marshal(res)

	if err != nil {
		InternalServerErrorHandler(w, req)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(jsonBytes)
}

func InternalServerErrorHandler(w http.ResponseWriter, req *http.Request) {
	w.WriteHeader(http.StatusInternalServerError)
	w.Write([]byte("500 Internal Server Error"))
}

func NotFoundErrorHandler(w http.ResponseWriter, req *http.Request) {
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte("404 Not Found"))
}

func validate(w http.ResponseWriter, req *http.Request) {
	switch {
	case req.Method == http.MethodGet:
		validateGet(w, req)
		return
	default:
		return
	}
}

func main() {
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)
	http.HandleFunc("/validate", validate)

	log.Println("Listening on :5678...")
	err := http.ListenAndServe(":5678", nil)
	if err != nil {
		log.Fatal(err)
	}
}
