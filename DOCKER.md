# 🚀 Docker Usage Workflow

### Set environment variables
Use default locations for the knowledge base or change the environment variables in the `docker-compose.yml` file.

```
EXAMPLE PROJECT STRUCTURE
--------------------------------
 pragma/
 ├── public/
 │   └── app.html        
 ├── server.js            
 ├── package.json
 ├── sessions/                              // only created once a workbench session has been created
 │   ├── pragma.workbench                   // unencrypted default workbench    
 │   └── pragma.workbench.enc               // encrypted workbench file
 └── knowledge_base/                        // can be set to other folder using KB_DIR env
      ├── attacks/
      │   ├── lfi.md
      │   ├── sqli.md
      │   └── ...                           // any .md file becomes an attack card
      ├── methodologies/
      │   ├── active-directory.md
      │   ├── pivoting.md
      │   └── ...                           // any .md file becomes a methodology card
      └── services/
          ├── 22.md                         // ssh
          ├── 80.md                         // http
          ├── 445.md                        // smb
          └── ...                           // any .md file becomes a service card
```

---

### 0. Before first run — create required directories

Docker will create missing volume-mounted directories as root-owned if they don't exist, which causes permission errors. Create them manually first:

```bash
mkdir -p sessions knowledge_base/services knowledge_base/attacks knowledge_base/methodologies
```

If using ENGRAM integration, also create the shared network:
```bash
docker network create pragma-net
```

---

### 1. First time build (only needed when code changes)

```bash
docker compose up -d --build
```

---

### 2. Start existing container

```bash
# Either
docker start pragma-workbench
# Or
docker compose up -d
```

You can now access it on http://localhost:3000

---

### 3. Stop container

```bash
# Either
docker stop pragma-workbench
# Or
docker compose down
```

---

### 4. View logs

```bash
docker logs -f pragma-workbench
```