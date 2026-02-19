# 📂 FTP (Port 21 - Control, Port 20 - Data)

### 1. Enumeration
* [ ] **Anonymous Login:** `ftp anonymous@<IP>` (use any password)
* [ ] **Banner Grab:** `nc -vn <IP> 21`
* [ ] **Browser Access:** `ftp://<IP>`

### 2. Exploitation
* **Active vs Passive:** If directory listing fails, toggle `passive` mode in your client.
* **Upload Test:** If you have write access, try uploading a `cmd.php` shell.