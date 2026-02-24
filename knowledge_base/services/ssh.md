# 🔒 SSH (Port 22)
### ⚡ Quick Wins
- [ ] **Auth Methods:** `ssh -v <IP>` (Check if it accepts passwords)
- [ ] **Banner:** `nc -vn <IP> 22`

### 🔍 Enumeration
- **Username Brute:** `hydra -L users.txt -p password <IP> ssh`
- **Weak Algos:** `nmap --script ssh2-enum-algos <IP>`

### 🚀 Exploitation
- **Key Recovery:** Search for `.ssh/id_rsa` in backups.
- **Default Creds:** Try `root:root`, `admin:admin`.