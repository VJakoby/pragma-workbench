# 🚀 Docker Usage Workflow
## NOT FINISHED YET
### 1. Add more service, attacks or methodologies cards
```
# Add more service, attacks or methodologies cards
 pragma/
 ├── public/
 │   └── app.html        
 ├── server.js            
 ├── package.json
 ├── notes/              (only created once a session has been created and exported) 
 └── knowledge_base/
    ├── attacks/
    │   ├── lfi.md
    │   ├── sqli.md
    │   └── ...          (any .md file becomes a attack card)
    ├── methodologies/
    │   ├── active-directory.md
    │   ├── pivoting.md
    │   └── ...          (any .md file becomes a methodology card)
    └── services/
        ├── 22.md        (SSH)
        ├── 80.md        (HTTP)
        ├── 445.md       (SMB)
        └── ...          (any .md file becomes a service card)
```

---

### 2. Build the image (only when code changes)
```bash
docker compose build
```

---

### 3. Start the webserver
```bash
docker compose up -d
---- OR ----
npm run docker:up
```
