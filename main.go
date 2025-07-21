package main

import (
	"log"
	"net/http"
)

func main() {
  fs := http.FileServer(http.Dir("./static"))
  http.Handle("/", fs)

  log.Println("Listening on :5678...")
  err := http.ListenAndServe(":5678", nil)
  if err != nil {
    log.Fatal(err)
  }
}
