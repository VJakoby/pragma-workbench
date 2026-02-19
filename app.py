import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import xml.etree.ElementTree as ET
import subprocess
import os
import json

# --- CONFIGURATION ---
CODENAME = "CINDERTRACE"
KB_DIR = "knowledge_base"
# Persistence Files (saved in the mounted /app/scans volume)
PWNED_FILE = "scans/pwned_state.json"
NOTES_FILE = "scans/node_notes.json"
LATERAL_FILE = "scans/lateral_moves.json"

st.set_page_config(layout="wide", page_title=f"{CODENAME} | Attack Chain")

# --- DATA PERSISTENCE HELPERS ---
def load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, "r") as f: return json.load(f)
        except: return default
    return default

# Initialize session states from files
if 'pwned_nodes' not in st.session_state:
    st.session_state.pwned_nodes = set(load_json(PWNED_FILE, []))
if 'node_notes' not in st.session_state:
    st.session_state.node_notes = load_json(NOTES_FILE, {})
if 'lateral_moves' not in st.session_state:
    st.session_state.lateral_moves = load_json(LATERAL_FILE, [])

def save_all():
    with open(PWNED_FILE, "w") as f: json.dump(list(st.session_state.pwned_nodes), f)
    with open(NOTES_FILE, "w") as f: json.dump(st.session_state.node_notes, f)
    with open(LATERAL_FILE, "w") as f: json.dump(st.session_state.lateral_moves, f)

# --- SEARCHSPLOIT ENGINE ---
def get_exploits(service_name, version):
    query = f"{service_name} {version}"
    try:
        # Run searchsploit via subprocess and get JSON output
        result = subprocess.run(['searchsploit', '--json', query], capture_output=True, text=True)
        return json.loads(result.stdout).get('RESULTS_EXPLOIT', [])
    except:
        return []

# --- GLOBAL CHECKLIST LOGIC ---
CHECKLIST_FILE = "scans/global_checklist.json"

if 'global_todo' not in st.session_state:
    st.session_state.global_todo = load_json(CHECKLIST_FILE, [
        {"task": "Initial Recon", "done": False},
        {"task": "Service Enumeration", "done": False},
        {"task": "Vulnerability Analysis", "done": False},
        {"task": "Privilege Escalation", "done": False},
        {"task": "Exfiltration / Loot", "done": False}
    ])

def save_checklist():
    with open(CHECKLIST_FILE, "w") as f:
        json.dump(st.session_state.global_todo, f)

# --- SIDEBAR UI ---
with st.sidebar:
    st.header("🎯 Global Checklist")
    
    # Input for new custom tasks
    new_task = st.text_input("Add Objective:", key="add_task")
    if st.button("Add"):
        st.session_state.global_todo.append({"task": new_task, "done": False})
        save_checklist(); st.rerun()

    # Render checklist
    for i, item in enumerate(st.session_state.global_todo):
        cols = st.columns([0.15, 0.85])
        # Using a checkbox for each task
        checked = cols[0].checkbox("", value=item['done'], key=f"check_{i}")
        if checked != item['done']:
            st.session_state.global_todo[i]['done'] = checked
            save_checklist()
        
        # Strike-through text if done
        task_text = f"~~{item['task']}~~" if checked else item['task']
        cols[1].markdown(task_text)
    
    if st.button("Clear Completed"):
        st.session_state.global_todo = [i for i in st.session_state.global_todo if not i['done']]
        save_checklist(); st.rerun()


# --- NMAP PARSER ---
def parse_nmap(file):
    tree = ET.parse(file)
    root = tree.getroot()
    nodes, edges, ver_map = [], [], {}
    
    for host in root.findall('host'):
        ip = host.find('address').get('addr')
        # Host (Blue)
        nodes.append(Node(id=ip, label=ip, size=25, color="#1f77b4")) 
        
        for port in host.iter('port'):
            if port.find('state').get('state') == 'open':
                svc_elem = port.find('service')
                svc = svc_elem.get('name') if svc_elem is not None else "unknown"
                ver = svc_elem.get('version') if svc_elem is not None else ""
                p_id = port.get('portid')
                node_id = f"{ip}:{p_id}-{svc}"
                
                ver_map[node_id] = (svc, ver, p_id)
                
                # Color logic: Red if PWNED, Orange if OPEN
                color = "#e74c3c" if node_id in st.session_state.pwned_nodes else "#f39c12"
                nodes.append(Node(id=node_id, label=f"{svc} ({p_id})", size=18, color=color))
                edges.append(Edge(source=ip, target=node_id))
    
    # Inject Lateral Movement Edges (Red arrows)
    for move in st.session_state.lateral_moves:
        edges.append(Edge(source=move['from'], target=move['to'], color="#e74c3c", label="LATERAL", dashed=True))
                
    return nodes, edges, ver_map

# --- UI LAYOUT ---
st.title(f"🔥 {CODENAME}")

with st.sidebar:
    st.header("1. Ingestion")
    uploaded_file = st.file_uploader("Upload Nmap XML", type=["xml"])
    st.divider()
    
    st.header("2. Reporting")
    if st.button("📑 Compile Attack Report"):
        report = f"# {CODENAME} Engagement Report\n\n## Compromised Nodes\n"
        for node in st.session_state.pwned_nodes:
            report += f"### 🚩 {node}\n**Notes:** {st.session_state.node_notes.get(node, 'No notes recorded.')}\n\n"
        st.download_button("Download .md Report", report, file_name="cinder_trace_report.md")

if uploaded_file:
    nodes, edges, ver_map = parse_nmap(uploaded_file)
    col1, col2 = st.columns([2, 1])

    with col1:
        st.subheader("Interactive Topology")
        config = Config(width=850, height=700, directed=True, nodeHighlightBehavior=True, physics=True)
        selected_node = agraph(nodes=nodes, edges=edges, config=config)

    with col2:
        if selected_node:
            st.header(f"📍 {selected_node}")
            
            # Action Row
            c1, c2 = st.columns(2)
            is_pwned = selected_node in st.session_state.pwned_nodes
            if c1.button("🚩 PWNED" if not is_pwned else "🏳️ RESET"):
                if is_pwned: st.session_state.pwned_nodes.discard(selected_node)
                else: st.session_state.pwned_nodes.add(selected_node)
                save_all(); st.rerun()
            
            # Notes Persistence
            note_key = f"note_{selected_node}"
            current_note = st.session_state.node_notes.get(selected_node, "")
            new_note = st.text_area("Findings/Credentials", value=current_note, height=150)
            if new_note != current_note:
                st.session_state.node_notes[selected_node] = new_note
                save_all()

            # Lateral Movement Builder
            with st.expander("🔗 Add Lateral Movement"):
                target = st.selectbox("Connect to:", [n.id for n in nodes if n.id != selected_node])
                if st.button("Link Nodes"):
                    st.session_state.lateral_moves.append({"from": selected_node, "to": target})
                    save_all(); st.rerun()

            st.divider()

            # --- SEARCHSPLOIT & PLAYBOOK ---
            if selected_node in ver_map:
                svc, ver, p_id = ver_map[selected_node]
                
                # SearchSploit
                with st.expander(f"🔍 Exploits for {svc} {ver}", expanded=True):
                    if ver:
                        results = get_exploits(svc, ver)
                        for r in results: st.markdown(f"- **{r['Title']}** (`{r['EDB-ID']}`)")
                    else: st.info("No version found for auto-exploit check.")

                # Tactical Playbook (Port > Service mapping)
                st.subheader("📖 Tactical Guide")
                check_files = [f"{p_id}.md", f"{svc}.md"]
                found_kb = False
                for f_name in check_files:
                    path = os.path.join(KB_DIR, f_name)
                    if os.path.exists(path):
                        with open(path, "r") as f: st.markdown(f.read())
                        found_kb = True; break
                if not found_kb: st.warning("No playbook found.")
        else:
            st.info("Click a node to begin analysis.")