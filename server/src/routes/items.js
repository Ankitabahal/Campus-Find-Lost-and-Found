import {Router} from 'express'; import multer from 'multer'; import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url'; import db from '../db.js'; import {auth,adminOnly} from '../middleware/auth.js'; import {scorePair} from '../matching.js';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const uploadsDir=path.resolve(__dirname,'../../uploads');
fs.mkdirSync(uploadsDir,{recursive:true});
const r=Router();const storage=multer.diskStorage({destination:uploadsDir,filename:(req,file,cb)=>cb(null,Date.now()+'-'+Math.round(Math.random()*1e9)+path.extname(file.originalname).toLowerCase())});const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>cb(null,/image\/(jpeg|png|webp)/.test(file.mimetype))});
async function notify(userId,type,message){if(userId)await db.execute('INSERT INTO Notification(user_id,notification_type,message,delivery_status) VALUES(?,?,?,\'SENT\')',[userId,type,message]);}
r.get('/',async(req,res)=>{try{const {q='',type='',category='',location=''}=req.query;let sql=`SELECT i.item_id,i.report_type,i.item_name,i.category,i.description,i.item_date,i.location,i.image_url,i.status,i.created_at,u.full_name AS reporter_name FROM Item_Report i JOIN User u ON u.user_id=i.reporter_id WHERE i.status IN ('PUBLISHED','MATCHED','CLAIMED')`;const p=[];if(type){sql+=' AND i.report_type=?';p.push(type.toUpperCase());}if(category){sql+=' AND i.category=?';p.push(category);}if(location){sql+=' AND i.location LIKE ?';p.push('%'+location+'%');}if(q){sql+=' AND (i.item_name LIKE ? OR i.description LIKE ?)';p.push('%'+q+'%','%'+q+'%');}sql+=' ORDER BY i.created_at DESC';const [rows]=await db.execute(sql,p);res.json(rows);}catch{res.status(500).json({message:'Could not load item reports.'});}});
r.post('/',auth,upload.single('image'),async(req,res)=>{try{const {report_type,item_name,category,description,item_date,location}=req.body;if(!['LOST','FOUND'].includes(report_type)||!item_name||!category||!description||!item_date||!location)return res.status(400).json({message:'Please complete all required item details.'});const image=req.file?'/uploads/'+req.file.filename:null;const [x]=await db.execute('INSERT INTO Item_Report(reporter_id,report_type,item_name,category,description,item_date,location,image_url,status) VALUES(?,?,?,?,?,?,?, ?,\'PUBLISHED\')',[req.user.id,report_type,item_name,category,description,item_date,location,image]);const [opposites]=await db.execute('SELECT * FROM Item_Report WHERE report_type=? AND status IN (\'PUBLISHED\',\'MATCHED\')',[report_type==='LOST'?'FOUND':'LOST']);for(const other of opposites){const fresh={item_id:x.insertId,report_type,item_name,category,description,item_date,location};const lost=report_type==='LOST'?fresh:other,found=report_type==='FOUND'?fresh:other;const m=scorePair(lost,found);if(m.score>=35){await db.execute('INSERT IGNORE INTO Match_Record(lost_item_id,found_item_id,match_score,match_reason) VALUES(?,?,?,?)',[lost.item_id,found.item_id,m.score,m.reason]);await notify(other.reporter_id,'MATCH',`Possible match for ${other.item_name}: ${item_name}. Check your matches.`);await notify(req.user.id,'MATCH',`A possible match was found for ${item_name}. Check your matches.`);}}await notify(req.user.id,'REPORT','Your '+report_type.toLowerCase()+' item report has been published.');res.status(201).json({message:'Report published successfully.',item_id:x.insertId});}catch(e){console.error(e);res.status(500).json({message:'Could not save report.'});}});
r.get('/mine',auth,async(req,res)=>{const [rows]=await db.execute('SELECT * FROM Item_Report WHERE reporter_id=? ORDER BY created_at DESC',[req.user.id]);res.json(rows);});
r.get('/matches/:id', auth, async (req, res) => {
  const [rows] = await db.execute(
    `SELECT m.match_id, m.match_score, m.match_reason,
      l.item_id AS lost_item_id, l.item_name AS lost_name, l.category AS lost_category,
      l.location AS lost_location, l.item_date AS lost_date, l.image_url AS lost_image,
      f.item_id AS found_item_id, f.item_name AS found_name, f.category AS found_category,
      f.location AS found_location, f.item_date AS found_date, f.image_url AS found_image
     FROM Match_Record m
     JOIN Item_Report l ON l.item_id=m.lost_item_id
     JOIN Item_Report f ON f.item_id=m.found_item_id
     WHERE (l.reporter_id=? OR f.reporter_id=?) AND (l.item_id=? OR f.item_id=?)
     ORDER BY m.match_score DESC`,
    [req.user.id, req.user.id, req.params.id, req.params.id]
  );
  res.json(rows);
});
r.get('/admin/all',auth,adminOnly,async(req,res)=>{const [rows]=await db.execute('SELECT i.*,u.full_name AS reporter_name,u.email FROM Item_Report i JOIN User u ON u.user_id=i.reporter_id ORDER BY i.created_at DESC');res.json(rows);});
r.patch('/admin/:id/status',auth,adminOnly,async(req,res)=>{const {status}=req.body;const allowed=['PUBLISHED','REJECTED','CLOSED'];if(!allowed.includes(status))return res.status(400).json({message:'Invalid status.'});const [rows]=await db.execute('SELECT reporter_id,item_name FROM Item_Report WHERE item_id=?',[req.params.id]);if(!rows.length)return res.status(404).json({message:'Report not found.'});await db.execute('UPDATE Item_Report SET status=? WHERE item_id=?',[status,req.params.id]);await notify(rows[0].reporter_id,'REPORT',`Your report for ${rows[0].item_name} was ${status.toLowerCase()} by the administrator.`);res.json({message:'Report status updated.'});});
export default r;
