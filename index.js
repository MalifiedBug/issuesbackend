import express from "express"; // "type": "module"
import { MongoClient } from "mongodb";
import cors from 'cors'
import * as dotenv from 'dotenv' ;
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  

const PORT = process.env.PORT
const MONGO_URL = process.env.MONGO_URL;

//connect mongodb

async function MongoConnect(){
    const client = await new MongoClient(MONGO_URL).connect();
    console.log('🕺 Mongo Connected ')
    return client;
}

const client = await MongoConnect();

//todays date function

let ts = Date.now();

let date_ob = new Date(ts);
let date = date_ob.getDate();
let month = date_ob.getMonth() + 1;
let year = date_ob.getFullYear();

// prints date & time in YYYY-MM-DD format
var newdate = date + "-" + month + "-" + year


app.get("/", function (request, response) {
  response.send("issues backend 📝");
});

//for user

app.post("/issue",async(req,res)=>{
    const {name,email,mobile,issueType,issueTitle,issueDescription} = req.body;
    const issueDb = await client.db("HelpDesk").collection("Issues").insertOne({...req.body,status:"pending",date:newdate});
    if(issueDb){
        res.status(200).send({msg:"issue registered",issueDb})
    }else{
        res.status(400).send({msg:"issue failed to register"})
    }
})

//for user and admin-filter

app.get("/issue/:name", async(req,res)=>{
    const name = req.params['name'];
    const issueDb = await  client.db("HelpDesk").collection("Issues").find({name}).toArray()
    if(issueDb){
        res.status(200).send(issueDb)
    }else{
        res.status(400).send({msg:"issues of the user not found"})
    }
})

//edit issue by user

app.put("/editissue/:id",async(req,res)=>{
    const id = req.params['id'];
    const issueDb = await  client.db("HelpDesk").collection("Issues").updateOne({_id:ObjectId(id)},{$set:{...req.body}})
    if(issueDb){
        console.log(issueDb)
        res.status(200).send({msg:"issue update successfully"})
    }else{
        res.status(400).send({msg:"failed to update; or no issue in db"})
    } 
})

//delete issue by user

app.delete("/deleteissue/:id",async (req,res)=>{
    const id = req.params['id'];
    const issueDb = await  client.db("HelpDesk").collection("Issues").deleteOne({_id:ObjectId(id)})
    if(issueDb){
        console.log(issueDb)
        res.status(200).send({msg:"issue delete successfully"})
    }else{
        res.status(400).send({msg:"failed to delete; or no issue in db"})
    }

})

//for admin

app.get("/allissues",async(req,res)=>{
    const issuesDb = await client.db("HelpDesk").collection("Issues").find({}).toArray();
    res.status(200).send(issuesDb)   
})

//for admin; update issue
app.put("/updateissue/:id",async(req,res)=>{
    const id = req.params['id'];
    const issueDb = await  client.db("HelpDesk").collection("Issues").updateOne({_id:ObjectId(id)},{$set:{...req.body}})
    if(issueDb){
        console.log(issueDb)
        res.status(200).send({msg:"issue update successfully"})
    }else{
        res.status(400).send({msg:"failed to update; or no issue in db"})
    } 
})

//sign in sign up services

async function hashedPassword(password) {
    const NO_OF_ROUNDS = 10;
    const salt = await bcrypt.genSalt(NO_OF_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  }

app.post("/signup", async function (request, response) {
    let { name, email, password } = request.body;
    let userdb = await client
      .db("HelpDesk")
      .collection("Users")
      .findOne({ email: email });
    if (userdb) {
      response.status(200).send({ msg: "user already present", userdb });
    } else {
      const hashedPass = await hashedPassword(password);
      let result = await client
        .db("HelpDesk")
        .collection("Users")
        .insertOne({ name,email: email, password: hashedPass, admin: false });
      response.send({ msg: "user added",name, email, result });
    }
  });
  
  app.post("/signin", async function (request, response) {
    let { email, password } = request.body;
    let userdb = await client
      .db("HelpDesk")
      .collection("Users")
      .findOne({ email: email });
  
    if (userdb) {
      const isSame = await bcrypt.compare(password, userdb.password);
  
      if (isSame) {
        console.log(userdb)
        var name = userdb.name;
        var admin = userdb.admin;
        var token = jwt.sign({ email: email }, process.env.JWT_SECRET);
        response.status(200).send({ msg: "logged in", token, name, admin });
      } else {
        response.status(200).send({ msg: "invalid credentials" });
      }
    } else {
      response.status(200).send({ msg: "no user found" });
    }
  });
 

app.listen(PORT, () => console.log(`The server started in: ${PORT} ✨✨`));