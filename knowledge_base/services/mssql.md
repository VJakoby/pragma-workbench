# 🗃️ MSSQL (Port 1433)
### ⚡ Quick Wins
- [ ] **Empty Pass:** `nmap -p 1433 --script ms-sql-empty-password <IP>`
- [ ] **RCE:** `mssqlclient.py <USER>@<IP>` -> `enable_xp_cmdshell`