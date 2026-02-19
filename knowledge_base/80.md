# 🌐 HTTP / HTTPS

### 1. Enumeration
* [ ] **Directories:** `gobuster dir -u http://<IP> -w common.txt`
* [ ] **Vhosts:** `ffuf -u http://<IP> -H "Host: FUZZ.domain.com" -w subdomains.txt`

### 2. SSL Check (443/8443)
* [ ] **Certificate:** Inspect the SSL certificate for hostnames or email addresses.