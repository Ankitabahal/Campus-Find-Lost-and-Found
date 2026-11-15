import jwt from 'jsonwebtoken';
export function auth(req,res,next){
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token) return res.status(401).json({message:'Please log in first.'});
 try{req.user=jwt.verify(token,process.env.JWT_SECRET||'development_secret_change_me');next();}
 catch{return res.status(401).json({message:'Session expired. Please log in again.'});}
}
export function adminOnly(req,res,next){if(req.user?.role!=='ADMIN')return res.status(403).json({message:'Administrator access required.'});next();}
