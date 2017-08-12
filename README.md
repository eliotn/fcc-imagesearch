## Image Search Abstraction Layer

This project is a simple image search api.

To run the server:

```node server.js```

API endpoints:

GET /api/imagesearch/{:query}?offset={:offset} - 
Get the result for the imagesearch query.  The offset is the page number.

GET /api/latest/imagesearch/ - 
Get the 10 last search queries, returns the query and a timestamp.