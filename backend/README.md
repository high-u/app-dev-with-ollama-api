# README

## Curl

```bash
curl -X POST http://localhost:3000/api/push-to-github \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "ref": "main"
    },
    "commit": {
      "message": "Added index.html and README.md"
    },
    "push": {
      "url": "https://github.com/high-u/my-new-repository-8.git",
      "remote": "origin"
    },
    "files": [
      {
        "filename": "index.html",
        "content": "<html><body>Hello</body></html>"
      },
      {
        "filename": "README.md",
        "content": "# README"
      }
    ]
  }'
```
