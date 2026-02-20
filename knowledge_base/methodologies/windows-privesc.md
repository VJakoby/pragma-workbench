# Windows Privilege Escalation
## WHO AM I ---
whoami
whoami /priv
systeminfo
hostname
net localgroup administrators

## QUICK WINS
SeImpersonatePrivilege    -> Potato attacks
SeBackupPrivilege         -> Acl-FullControl.ps1
AlwaysInstallElevated     -> MSI abuse
Unquoted Service Paths    -> Service hijack
SeMachineAccountPrivilege -> Allows to add a machine to the domain

## USERS / GROUPS
(Look for interesting groups, Server Operators --> "Malicious service"
net user
net localgroup administrators
whoami /groups = Look for interesting groups

## SERVICES & PATCHES
sc query
sc qc <service>
Get-Service
wmic qfe list # Check latest installed patches(investigate the patches)
Check:
- Writable service binary
- Writable service path

## SCHEDULED TASKS
schtasks /query /fo LIST /v
SCHEDULED TASKS:

## FILE PERMISSIONS
icacls "C:\Program Files"
accesschk.exe -uwcqv "Authenticated Users" *

## CREDENTIALS
cmdkey /list
reg query HKLM /f password /t REG_SZ /s
reg query HKLM
reg query HKCU
findstr /si password *.xml *.ini *.txt
SAM / SYSTEM / SECURITY

## NETWORK
ipconfig /all
netstat -ano

## DLL HIJACKING
Check writable dirs in PATH
ProcMon (if GUI)

## AUTOMATION (AFTER MANUAL)
winpeas.exe
Seatbelt.exe
PowerUp.ps1

## KERNEL (LAST RESORT)
systeminfo -> patch level
searchsploit windows kernel
