//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require('mongoose-findorcreate');
const { render } = require("ejs");
const { use } = require('passport');


const app = express();

app.set('view engine' , 'ejs');
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

app.use(session({
    secret: 'This is my secret key',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/shoppingDB" , {useNewUrlParser:true});
mongoose.set("useCreateIndex" , true);

const UserSchema = new mongoose.Schema({
    email : String ,
    password : String,
    googleId : String,
    items  : [String]
});

UserSchema.plugin(passportLocalMongoose);
UserSchema.plugin(findOrCreate);

const User = mongoose.model("User" , UserSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
    done(null, user.id);
});
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/mylist",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/" , function(req,res){
    res.render('home');
});

app.get("/signup",function(req,res){
    res.render('signup');
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/mylist", 
passport.authenticate('google', { failureRedirect: "/" }),
function(req, res) {
res.redirect('/mylist');
});

app.get("/mylist" , function(req,res){
    if(req.isAuthenticated())
    {
        User.findById(req.user._id , function(err,foundUser){
            if(!err)
            {
                res.render("mylist" , {newItems : foundUser.items});
            }
            else{
                console.log(err);
            }
        })
    }
    else{
        res.redirect("/");
    }
});

app.post("/mylist" , function(req,res){
    if(req.isAuthenticated())
    {
        User.findById(req.user._id , function(err , foundUser){
            if(!err)
            {
                const newI = req.body.newItem ; 
                foundUser.items.push(newI);
                foundUser.save();
                res.redirect("/mylist")
            }
            else{
                console.log("Error");
            }
        });
    }
    else{
        res.redirect("/");
    }
});

app.post("/signup" , (req,res) => {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/signup");
        }
        else{
            passport.authenticate("local")(req,res , function(){
                res.redirect("/mylist");
            });
        }
    });
    
});

app.post("/" , function(req,res){
    const user = new User({
        username : req.body.username,
        password : req.body.password
    });
    req.logIn(user , function(err){
        if(err)
        {
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(err){
                if(err)
                {
                    alert("Wrong Data")
                }else
                {
                    res.redirect("/mylist");
                }
                
            });
        }
    });
});

app.post("/delete" , function(req,res){
    if(req.isAuthenticated())
    {
        const checkeditemId = req.body.checkbox;
        User.updateOne({'_id' : req.user._id },{$pull : { items : checkeditemId}} ,function(err,){
            if(!err)
            {
                res.redirect('/mylist');
            }
            else
            {
                console.log(err);
            }
        })
    }
});


app.post("/logout" , function(req,res){
    req.logOut();
    res.redirect("/");
});


app.listen(3000,function(){
    console.log("Server Started at 3000 port");
});