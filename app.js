require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const date = require(__dirname + "/date.js");
const mongoose = require("mongoose");
const _ = require("lodash");
const { functionsIn, escapeRegExp } = require("lodash");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/todolistDB", { useNewUrlParser: true });

const itemsSchema = {
    item: String
};
const listSchema = {
    name: String,
    items: [itemsSchema]
};
const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        require: true,
        index: true,
        unique: true,
        sparse: true

    },
    lists: [listSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

/*
{
    googleId: als;kfdjfjak;l,
    lists = [
        {
            name: String,
            items = ["hello", "hi"]
        }
        {
            name: 
        }
    ]
}
*/


// const homeItem = mongoose.model("HomeItem", itemsSchema);
const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (error, user) {
        done(error, user);
    })
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/To-Do-List",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ googleId: profile.id, username: profile.displayName }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.set("view engine", "ejs");
var today = date.getDate();

app.get("/", function (req, res) {

    if (req.isAuthenticated()) {
        User.find({ googleId: req.user.googleId }, function (err, foundUser) {
            let userLists = foundUser[0].lists;
            res.render("home", { date: today, listTitle: "Welcome", lists: userLists });
        })
    }
    else {
        res.redirect("/login");
    }
    // homeItem.find({}, function (error, foundItems) {
    //     if (foundItems.length === 0) {
    //         res.render("List", { date: today, listTitle: "Home List", newListItems: [] });
    //     } else {
    //         res.render("List", { date: today, listTitle: "Home List", newListItems: foundItems });
    //     }
    // })
})

app.get("/auth/google", passport.authenticate("google", {
    scope: ["profile"]
}));

app.get("/auth/google/To-Do-List",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect("/");
    });

app.get("/login", function (req, res) {
    res.render("login");
})

app.get("/logout", function (req, res) {
    req.logout(function (error) {
        if (error) {
            console.log(error);
        }
        else {
            res.redirect("/");
        }
    });
})

// app.post("/", function (req, res) {
//     var itemName = req.body.newItem;
//     var listName = req.body.list;

//     const newItem = new homeItem({
//         name: itemName
//     })

//     if (listName === "Home List") {
//         newItem.save();
//         res.redirect("/");
//     }
//     else {
//         List.findOne({ name: listName }, function (error, foundList) {
//             foundList.items.push(newItem);
//             foundList.save();
//             res.redirect("/" + listName);
//         })
//     }
// })

app.get("/:customListName", function (req, res) {

    if (req.isAuthenticated()) {
        const customListName = _.capitalize(req.params.customListName);

        // console.log(req.user.googleId);
        let listExists = false;
        User.find({ googleId: req.user.googleId }, function (err, foundUser) {

            foundUser[0].lists.every(function (element, index) {
                if (element.name === customListName) {
                    listExists = true;
                    return false;
                };
            })
            if (listExists === true) {
                listExists = false;
                res.render("error");
            }
            else {
                let newList = {
                    name: customListName,
                    items: []
                };
                foundUser[0].lists.push(newList);
                foundUser[0].save();
                res.redirect("/");
            }
        })
    }
    else {
        res.redirect("/login");
    }
})

app.post("/list", function (req, res) {
    if (req.isAuthenticated()) {

        let requestedList = req.body.hiddenListName || req.query.listName;

        User.find({ googleId: req.user.googleId }, function (err, foundUser) {
            foundUser[0].lists.forEach(function (element) {
                if (element.name === requestedList) {
                    res.render("list", { date: today, listTitle: requestedList, list: element.items });
                    return false;
                };
            })
        })
    }
    else {
        res.redirect("/login");
    }
});

app.post("/add-item", function (req, res) {
    if (req.isAuthenticated()) {
        let listToBeUpdated = req.body.list;
        let newItem = {
            item: req.body.newItem
        }

        User.find({ googleId: req.user.googleId }, function (err, foundUser) {
            foundUser[0].lists.forEach(function (element) {
                if (element.name === listToBeUpdated) {
                    element.items.push(newItem);
                    return false;
                }
            })
            foundUser[0].save();
            res.redirect(307, "/list?listName=" + listToBeUpdated);
        })
    }
})

//Delete a single element from a list
app.post("/delete", function (req, res) {
    if (req.isAuthenticated()) {

        const listName = req.body.listName;
        const checkedItemName = req.body.checkbox;
        let indexToBeDeleted = 0;

        User.find({googleId: req.user.googleId}, function(err, foundUser) {
            foundUser[0].lists.forEach(function(list) {
                if(list.name===listName) {
                    list.items.forEach(function(itemDoc, index) {
                        if(itemDoc.item === checkedItemName) {
                            indexToBeDeleted = index;
                            return false;
                        }
                    })
                    list.items.splice(indexToBeDeleted, 1);
                }
                return false;
            })
            foundUser[0].save();
            res.redirect(307, "/list?listName=" + listName);
        })


    }
    else {
        res.redirect("/login");
    }
});


//Delte Whole list
app.post("/delete-list", function (req, res) {
    if (req.isAuthenticated()) {
        let indexToBeDeleted = 0;
        listToBeDeleted = req.body.hiddenListName;
        User.find({ googleId: req.user.googleId }, function (err, foundUser) {
            foundUser[0].lists.forEach(function (list, index) {
                if (list.name === listToBeDeleted) {
                    indexToBeDeleted = index;
                }
            })
            foundUser[0].lists.splice(indexToBeDeleted, 1);
            foundUser[0].save();
            res.redirect("/");
        })
    }
    else {
        res.redirect("/login");
    }
})

app.get("/about", function (req, res) {
    res.render("about");
})

let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}
app.listen(port, function () {
    console.log("Server has started!");
});