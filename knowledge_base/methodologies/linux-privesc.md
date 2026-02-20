# Linux Privilege Escalation

* [ ] sudo misconfigurations
* [ ] SUID binary abuse (GTFOBins)
* [ ] Writable cron jobs
* [ ] Writable systemd services
* [ ] Credentials in config files
* [ ] PATH hijacking
* [ ] Kernel exploits (LAST RESORT)

### Automation (AFTER MANUAL):
* [ ] linpeas.sh
* [ ] pspy

### WHOAMI
`whoami`
`id`
`sudo -l`
`uname -a`

### QUICK WINSS

`sudo -l`                    -> sudo abuse
`find / -perm -4000 -type f`  -> SUID binaries
`crontab -l`                 -> cron jobs
`ls -la /etc/cron*`          -> writable cron
`ps aux`                     -> root processes

### FILESYSTEM
`find / -writable -type f 2>/dev/null`
`find / -writable -type d 2>/dev/null`
`ls -la /opt`
`ls -la /var/www`

### GTFOBINS
Check SUID / sudo binaries:
- `vim`
- `nano`
- `find`
- `awk`
- `perl`
- `python`
- `tar`
- `nmap`

### Credentials
`grep -Ri "pass" /etc /home 2>/dev/null`
`cat ~/.bash_history`
`cat /etc/shadow (if readable)`
`find / -name "*.conf" 2>/dev/null`

### PATH HIJACK
`echo $PATH`
Check writable PATH dirs

### SERVICES
`systemctl list-units --type=service`
Check writable service files

### NETWORK
`netstat -tulnp`
`ss -lntp`

### AUTOMATION (AFTER MANUAL)
`linpeas.sh`
`pspy`

### KERNEL (LAST RESORT)
`searchsploit kernel`
`uname -a`
