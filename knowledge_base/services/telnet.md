# 📺 Telnet (Port 23)
### ⚡ Quick Wins
- [ ] **Connectivity:** `telnet <IP> 23`
- [ ] **Sniffing:** Use Wireshark to capture cleartext creds.

### 🔍 Enumeration
- **Brute Force:** `hydra -L users.txt -P pass.txt <IP> telnet`