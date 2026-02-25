# 📤 FTP (Port 21)
### ⚡ Quick Wins
- [ ] **Anonymous Login:** `ftp <IP>` (Try `anonymous:anonymous`)
- [ ] **Banner Grab:** `nc -vn <IP> 21`

### 🔍 Enumeration
- **Nmap Scripts:** `nmap -sV -p 21 --script ftp-anon <IP>`
- **Brute Force:** `hydra -L users.txt -P pass.txt <IP> ftp`

### 🚀 Exploitation
- **Exploits:** Check for `vsftpd 2.3.4` backdoor.