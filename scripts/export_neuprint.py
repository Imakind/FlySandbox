"""Optional API verification. pip install neuprint-python; set NEUPRINT_APPLICATION_CREDENTIALS.
Writes research/neuprint-edge.json, never reads or prints a token in the UI.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from neuprint import Client

token = os.environ.get('NEUPRINT_APPLICATION_CREDENTIALS')
if not token:
    raise SystemExit('Set NEUPRINT_APPLICATION_CREDENTIALS to your personal neuPrint token.')
client = Client('https://neuprint.janelia.org', dataset='male-cns:v1.0', token=token)
query = '''MATCH (a:Neuron {type: 'LC4'})-[c:ConnectsTo]->(b:Neuron {type: 'DNp01'})
RETURN a.bodyId AS pre, b.bodyId AS post, c.weight AS weight'''
try:
    frame = client.fetch_custom(query)
except Exception:
    raise SystemExit('neuPrint request failed. Check token, connection and dataset availability.') from None
if frame.empty:
    raise SystemExit('No edges returned; built-in snapshot has not been changed.')
output = Path(__file__).resolve().parents[1] / 'research' / 'neuprint-edge.json'
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps({'dataset': 'male-cns:v1.0', 'retrieved': datetime.now(timezone.utc).isoformat(),
    'total': int(frame['weight'].sum()), 'edges': frame.to_dict(orient='records')}, indent=2), encoding='utf-8')
print(f'Wrote {len(frame)} edges; total contacts: {int(frame["weight"].sum())}.')
