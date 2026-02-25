# 📥 IMAP (Port 143)
### ⚡ Quick Wins
- [ ] **Capabilities:** `nmap -p 143 --script imap-capabilities <IP>`
- [ ] **Brute:** `hydra -L users.txt -P pass.txt <IP> imap`