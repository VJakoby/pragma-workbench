# 🚀 Docker Usage Workflow

### Add more service, attacks or methodologies cards
> Make sure your KB directories match the folder structure
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

### 1. First time build (only when code changes)
```bash
docker compose up -d --build
```

---

### 2. Start existing container

```bash
# Either
docker start pragma
# Or
docker compose up

# You can now access it on https://localhost:3000
```

---

### 3. Start the webserver
```bash
docker start pragma
# ---- OR ----
docker compose up
```

### Stop existing container
```bash
docker stop pragma
```

---

### View logs
```bash
docker logs -f pragma
```
