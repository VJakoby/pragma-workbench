# ✉️ SMTP (Port 25)
### ⚡ Quick Wins
- [ ] **User Enum:** `telnet <IP> 25` -> `VRFY root`
- [ ] **Open Relay:** `nmap -p 25 --script smtp-open-relay <IP>`

### 🔍 Enumeration
- **Tooling:** `smtp-user-enum -M VRFY -U users.txt -t <IP>`