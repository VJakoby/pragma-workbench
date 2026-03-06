# 🚀 Docker Usage Workflow

### Set enviroment variables
Use default locations for the knowledge base or change the environemnt variables `docker-compose.yml` file.

```
EXAMPLE PROJECT STRUCTURE
--------------------------------
 pragma/
 ├── public/
 │   └── app.html        
 ├── server.js            
 ├── package.json
 ├── sessions/                  // only created once a workbench session has been created
     ├── pragma.workbench       // session file for workbench    
     └── pragma.workbench.enc   // encrypted session file for workbench
 └── knowledge_base/            // can be set to other folder using the KB_DIR env
      ├── attacks/
      │   ├── lfi.md
      │   ├── sqli.md
      │   └── ...               // any .md file becomes a attack card
      ├── methodologies/
      │   ├── active-directory.md
      │   ├── pivoting.md
      │   └── ...               // any .md file becomes a methodology card
      └── services/
          ├── 22.md             // ssh
          ├── 80.md             // http
          ├── 445.md            // smb
          └── ...               // any .md file becomes a service card
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
