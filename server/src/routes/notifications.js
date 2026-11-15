import {Router} from 'express';import db from '../db.js';import {auth} from '../middleware/auth.js';const r=Router();
r.get('/',auth,async(req,res)=>{const [rows]=await db.execute('SELECT * FROM Notification WHERE user_id=? ORDER BY created_at DESC LIMIT 100',[req.user.id]);res.json(rows);});
r.patch('/:id/read',auth,async(req,res)=>{await db.execute('UPDATE Notification SET is_read=1 WHERE notification_id=? AND user_id=?',[req.params.id,req.user.id]);res.json({message:'Notification marked as read.'});});
export default r;
