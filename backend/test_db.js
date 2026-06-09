const db = require('./db');
db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sticky_notes'").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
