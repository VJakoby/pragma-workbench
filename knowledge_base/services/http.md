# 🌐 HTTP (Port 80)
### ⚡ Quick Wins
- [ ] **Discovery:** `whatweb http://<IP>`
- [ ] **Robots:** Check `http://<IP>/robots.txt`

### 🔍 Enumeration
- **Fuzzing:** 
    - `gobuster dir -u http://<IP> -w /usr/share/wordlists/dirb/common.txt`
    - `ffuf http://<IP>/FUZZ -w /usr/share/dirbuster/common.txt`
- VHOSTS
    - `ffuf -u http://<IP> -H "Host: FUZZ.domain.com" -w subdomains.txt`