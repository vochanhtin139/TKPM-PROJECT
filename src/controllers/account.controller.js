const Account = require("../models/account.model");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Evaluate = require("../models/evaluate.model");
const fs = require("fs");
const path = require("path");
const passport = require("passport");
const { sendForgotPasswordMail } = require("../utils/mail");
const bcrypt = require("bcrypt");
const {
  mutipleMongooseToObject,
  mongooseToObject,
} = require("../utils/mongoose");
const mongoose = require("../utils/mongoose");
class acccountController {
  // [GET] account/sign-up
  getSignUp = async (req, res, next) => {
    try {
      res.render("sign-up", {
        registerMessage: req.flash("registerMessage"),
        reqUrl: req.query.reqUrl,
      });
    } catch (err) {
      next(err);
    }
  };

  // [POST] account/sign-up
  signUp = async (req, res, next) => {
    passport.authenticate("local-register", (error, user) => {
      if (error) {
        return next(error);
      }
      // Đăng kí không thành công, load lại trang đăng kí
      if (!user) {
        console.log("Đăng kí không thành công");
        return res.redirect(`/account/sign-up`);
      } else {
        // Đăng kí thành công
        res.redirect("/account/sign-in?success=true");
      }
    })(req, res, next);
  };

  // [GET] account/sign-in
  getSignIn = async (req, res, next) => {
    try {
      if (req.isAuthenticated()) {
        return res.redirect("/account/my-profile");
      }

      if (req.query?.success == "true") {
        res.locals.registerMessage =
          "You have registered successfully. Please login!";
        console.log("OK");
      } else if (req.url.includes("?")) {
        res.locals._loginFirst = "You haven't logged in. Please login first!";
      }
      res.render("sign-in", {
        loginMessage: req.flash("loginMessage"),
        reqUrl: req.query.reqUrl,
      });
    } catch (err) {
      next(err);
    }
  };

  // [POST] account/sign-in
  signIn = async (req, res, next) => {
    let keepSignedIn = req.body.keepSignedIn;
    let cart = req.session.cart;
    let reqUrl = req.body.reqUrl ? req.body.reqUrl : "/account/my-profile";
    passport.authenticate("local-login", (error, user) => {
      if (error) {
        return next(error);
      }
      if (!user) {
        // Xác thực thất bại
        return res.redirect(`/account/sign-in?reqUrl=${reqUrl}`);
      }
      req.logIn(user, (error) => {
        if (error) {
          // Đăng nhập thất bại
          return next(error);
        }
        // Đăng nhập thành công
        // Get the account ID from the logged-in user
        const accountId = user._id; // Adjust this to match your account model field name
        req.session.cart = cart;
        // Append the account ID as a slug to the "reqUrl"
        if (reqUrl == "/account/my-profile") {
          reqUrl = `${reqUrl}/${accountId}`;
        }
        req.session.cookie.maxAge = keepSignedIn ? 24 * 60 * 60 * 1000 : null;
        return res.redirect(reqUrl);
      });
    })(req, res, next);
  };

  // Authentication and Authorization
  isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect(`/account/sign-in?reqUrl=${req.originalUrl}`);
  };

  isAdmin = (req, res, next) => {
    if (req.user.role == "Admin") {
      return next();
    }
    res.status(404).render("error", {
      message: "File not found!",
    });
  };

  isSeller = (req, res, next) => {
    if (req.user.role == "Seller" || req.user.role == "Admin") {
      return next();
    }
    res.status(404).render("error", {
      message: "File not found!",
    });
  };

  // [GET] account/sign-out
  signOut = async (req, res, next) => {
    let cart = req.session.cart;
    req.logout((error) => {
      if (error) {
        return next(error);
      }
      req.session.cart = cart;
      res.redirect("/");
    });
  };

  // [GET] account/forgot
  showForgotPassword = (req, res, next) => {
    res.render("forgot-password");
  };

  // [POST] acccount/forgot
  forgotPassword = async (req, res, next) => {
    let email = req.body.email;
    // Check email tồn tại
    let user = await Account.findOne({ email: email });
    if (user) {
      const host = req.header("host");
      // Cập nhật mới ngẫu nhiên 1 password cho user trong database
      const { generateRandomStr } = require("../utils/function-helpers");
      // Hash mật khẩu và update vào database
      const newPassword = generateRandomStr(8);
      await Account.updateOne(
        { _id: user._id },
        {
          password: bcrypt.hashSync(newPassword, bcrypt.genSaltSync(8)),
        }
      );
      // Gửi mail
      sendForgotPasswordMail(user, host, newPassword)
        .then((result) => {
          console.log("Email has been sent");
          // Thông báo thành công
          return res.render("forgot-password", { done: true });
        })
        .catch((error) => {
          return res.render("forgot-password", {
            message:
              "An error has occured when sending to your email address. Please check your email address!",
          });
        });
    } else {
      // Ngược lại, thông báo email k tồn tại
      return res.render("forgot-password", {
        message: "Email does not exist!",
      });
    }
  };

  // [GET] account/page/:id
  getAccountPage = async (req, res, next) => {
    try {
      const account = await Account.findById(req.params.id);
      if (account.role == "Seller") {
        res.locals._isSeller = true;
        let page = isNaN(req.query.page)
          ? 1
          : Math.max(1, parseInt(req.query.page));
        const limit = 8;
        const productAll = await Product.find({
          idAccount: account._id,
          $or: [{ status: "Available" }, { status: "Reported" }],
        });
        const products = await Product.find({
          idAccount: account._id,
          $or: [{ status: "Available" }, { status: "Reported" }],
        })
          .skip((page - 1) * limit)
          .limit(limit);
        let options = [];
        let numOfProduct = 0;
        let evaluates;
        let numOfRating = 0;
        let sumRating = 0;
        for (let i = 0; i < productAll.length; i++) {
          options.push({ idProduct: productAll[i]._id });
          numOfProduct += productAll[i].stock;
        }
        if (productAll.length > 0) {
          if (options.length != 0) {
            evaluates = await Evaluate.find({
              $or: options,
            });
          }
          for (let i = 0; i < evaluates.length; i++) {
            sumRating += evaluates[i].rating;
            if (evaluates[i].rating > 0) {
              numOfRating += 1;
            }
          }
          res.locals.products = mutipleMongooseToObject(products);
          res.locals._numberOfReview = evaluates.length;
          res.locals._numberOfProduct = numOfProduct;
          res.locals._avgOfRating = (sumRating / numOfRating).toFixed(1);
          res.locals._numberOfItems = productAll.length;
          res.locals._limit = limit;
          res.locals._currentPage = page;
        } else {
          res.locals._numberOfProduct = 0;
          res.locals._numberOfReview = 0;
          res.locals._avgOfRating = 0;
        }
      } else {
        const orders = await Order.find({
          idAccount: req.params.id,
          status: "successful",
        });
        let totalPay = 0;
        for (const order of orders) {
          for (const product of order.detail) {
            const productInfo = await Product.findById(product.idProduct);
            totalPay += product.quantity * productInfo.price;
          }
        }
        let totalSucOrder = await Order.find({
          idAccount: req.params.id,
          status: "successful",
        }).countDocuments();
        res.locals._totalOrder = orders.length;
        res.locals._totalSucOrder = totalSucOrder;
        res.locals._totalPay = totalPay;
      }
      res.render("shop-info", {
        account: mongooseToObject(account),
        convertMoney: (str) => {
          return Number(str).toLocaleString("it-IT", {
            style: "currency",
            currency: "VND",
          });
        },
      });
    } catch (err) {
      next(err);
    }
  };

  reportUser = async (req, res, next) => {
    try {
      const accountId = req.params.idUser;
      const user = await Account.findById(accountId);
      user.accountStatus = "Reported";
      await user.save();

      res.redirect(`/account/page/${req.params.idUser}`);
    } catch (err) {
      next(err);
    }
  };

  getMyProfile = async (req, res, next) => {
    try {
      const user = await Account.findById(req.params._id);
      const idUser = user._id;
      res.locals.user = mongooseToObject(user);
      if (user.role === "Admin") {
        res.locals.switchRole = "Admin";
        res.locals.switchLink = "announcement";
      } else if (user.role === "Buyer") {
        res.locals.switchRole = "Become seller";
        res.locals.switchLink = "account/become-seller/" + idUser;
      } else {
        res.locals.switchRole = "Sale management";
        res.locals.switchLink = "product/dashboard";
      }

      res.render("profile_updating");
    } catch (err) {
      next(err);
    }
  };

  updateMyProfile = async (req, res, next) => {
    // res.json(req.body);
    // Account.updateOne({_id: req.params._id}, req.body);
    const accountId = req.params._id;
    const user = await Account.findById(accountId);

    user.firstName = req.body.firstName;
    user.lastName = req.body.lastName;
    user.address = req.body.address;
    user.email = req.body.email;
    user.phone = req.body.phone;
    user.job = req.body.job;
    user.avatar = req.body.avatarPath;
    await user.save();
    try {
      // Check if the present password matches the one in the database
      const isPasswordValid = await bcrypt.compare(
        req.body.presentPassword,
        user.password
      );
      if (!isPasswordValid) {
        req.flash("changePasswordMessage", "Incorrect present password.");
        return res.redirect(`/account/my-profile/${req.params._id}`);
      }

      // Hash the new password and update it in the database
      const hashedNewPassword = await bcrypt.hash(req.body.newPassword, 10);
      user.password = hashedNewPassword;

      // Save the updated user data to the database
      await user.save();

      req.flash("changePasswordMessage", "Password updated successfully.");
      res.redirect(`/account/my-profile/${req.params._id}`);
    } catch (err) {
      next(err);
    }
  };

  getMyOrder = async (req, res, next) => {
    try {
      const user = await Account.findById(req.params._id);
      const accountId = user._id;
      const orders = await Order.find({
        idAccount: accountId,
        status: "successful",
      })
        .populate("idAccount")
        .populate("detail.idProduct")
        .populate("idSeller")
        .sort({ date: -1 });
      const orderObject = mutipleMongooseToObject(orders);

      res.locals.user = mongooseToObject(user);
      if (user.role === "Admin") {
        res.locals.switchRole = "Admin";
        res.locals.switchLink = "announcement";
      } else if (user.role === "Buyer") {
        res.locals.switchRole = "Become seller";
        res.locals.switchLink = "account/become-seller/" + accountId;
      } else {
        res.locals.switchRole = "Sale management";
        res.locals.switchLink = "product/dashboard";
      }
      res.locals.orders = orderObject;

      res.render("my_order");
    } catch (err) {
      next(err);
    }
  };

  getMyOrderPending = async (req, res, next) => {
    try {
      const user = await Account.findById(req.params._id);
      const accountId = user._id;
      const orders = await Order.find({
        idAccount: accountId,
        status: "pending",
      })
        .populate("idAccount")
        .populate("detail.idProduct")
        .populate("idSeller")
        .sort({ date: -1 });
      const orderObject = mutipleMongooseToObject(orders);

      var products = [];
      for (var i of orderObject) {
        for (var j of i.detail) {
          Object.assign(j, { idOrder: i._id });
          var temp = [];
          temp.push(j);
          products.push(j);
        }
      }

      if (user.role === "Admin") {
        res.locals.switchRole = "Admin";
        res.locals.switchLink = "announcement";
      } else if (user.role === "Buyer") {
        res.locals.switchRole = "Become seller";
        res.locals.switchLink = "account/become-seller/" + accountId;
      } else {
        res.locals.switchRole = "Sale management";
        res.locals.switchLink = "product/dashboard";
      }
      res.locals.orders = orderObject;
      res.locals.products = products;
      res.locals.user = mongooseToObject(user);

      res.render("my_order-pending");
    } catch (err) {
      next(err);
    }
  };

  getMyOrderCancelled = async (req, res, next) => {
    try {
      const user = await Account.findById(req.params._id);
      const accountId = user._id;
      const orders = await Order.find({
        idAccount: accountId,
        status: "cancelled",
      })
        .populate("idAccount")
        .populate("detail.idProduct")
        .populate("idSeller")
        .sort({ date: -1 });
      const orderObject = mutipleMongooseToObject(orders);

      var products = [];
      for (var i of orderObject) {
        for (var j of i.detail) {
          Object.assign(j, { idOrder: i._id });
          var temp = [];
          temp.push(j);
          products.push(j);
        }
      }
      res.locals.orders = orderObject;
      res.locals.products = products;
      res.locals.user = mongooseToObject(user);

      if (user.role === "Admin") {
        res.locals.switchRole = "Admin";
        res.locals.switchLink = "announcement";
      } else if (user.role === "Buyer") {
        res.locals.switchRole = "Become seller";
        res.locals.switchLink = "account/become-seller/" + accountId;
      } else {
        res.locals.switchRole = "Sale management";
        res.locals.switchLink = "product/dashboard";
      }

      res.render("my_order-cancelled");
    } catch (err) {
      next(err);
    }
  };

  getBecomeSeller = async (req, res, next) => {
    try {
      const accountId = req.params._id;
      const user = await Account.findById(accountId);
      res.locals.user = mongooseToObject(user);
      res.locals.switchRole = "Become seller";
      res.locals.switchLink = "account/become-seller/" + accountId;

      if (user.accountStatus === "Pending") {
        res.render("become_seller-pending");
      } else {
        // Yêu cầu trở thành người bán đã gửi và tài khoản đã được chấp thuận
        res.render("become_seller");
      }
    } catch (err) {
      next(err);
    }
  };

  registerSeller = async (req, res, next) => {
    try {
      const accountId = req.params._id;
      const user = await Account.findById(accountId);

      user.requestStatus = "Become-seller";
      user.accountStatus = "Pending";
      user.shopName = req.body.shopName;
      user.address = req.body.address;
      user.job = req.body.job;
      await user.save();

      res.redirect(`/account/become-seller/${req.params._id}`);
    } catch (err) {
      next(err);
    }
  };

  // [GET] account/all
  getAllAccount = async (req, res, next) => {
    try {
      let page = isNaN(req.query.page)
        ? 1
        : Math.max(1, parseInt(req.query.page));

      const limit = 10;
      const accounts = await Account.find()
        .sort({ time: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      res.locals._numberOfItems = await Account.find().countDocuments();
      res.locals._limit = limit;
      res.locals._currentPage = page;

      res.render("admin_account_all", {
        accounts: mutipleMongooseToObject(accounts),
        numOfAccounts: accounts.length,
      });
    } catch (err) {
      next(err);
    }
  };

  // [GET] account/pending
  getPendingAccount = async (req, res, next) => {
    try {
      let page = isNaN(req.query.page)
        ? 1
        : Math.max(1, parseInt(req.query.page));

      const limit = 10;
      const accounts = await Account.find({ accountStatus: "Pending" })
        .sort({ time: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      res.locals._numberOfItems = await Account.find({
        status: "Pending",
      }).countDocuments();
      res.locals._limit = limit;
      res.locals._currentPage = page;
      res.render("admin_account_pending", {
        accounts: mutipleMongooseToObject(accounts),
        numOfAccounts: accounts.length,
      });
    } catch (err) {
      next(err);
    }
  };

  // [GET] account/reported
  getReportedAccount = async (req, res, next) => {
    try {
      let page = isNaN(req.query.page)
        ? 1
        : Math.max(1, parseInt(req.query.page));

      const limit = 10;
      const accounts = await Account.find({ accountStatus: "Reported" })
        .sort({ time: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      res.locals._numberOfItems = await Account.find({
        status: "Reported",
      }).countDocuments();
      res.locals._limit = limit;
      res.locals._currentPage = page;
      res.render("admin_account_reported", {
        accounts: mutipleMongooseToObject(accounts),
        numOfAccounts: accounts.length,
      });
    } catch (err) {
      next(err);
    }
  };

  // [GET] account/banned
  getBannedAccount = async (req, res, next) => {
    try {
      let page = isNaN(req.query.page)
        ? 1
        : Math.max(1, parseInt(req.query.page));

      const limit = 10;
      const accounts = await Account.find({ accountStatus: "Banned" })
        .sort({ time: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      res.locals._numberOfItems = await Account.find({
        status: "Banned",
      }).countDocuments();
      res.locals._limit = limit;
      res.locals._currentPage = page;
      res.render("admin_account_banned", {
        accounts: mutipleMongooseToObject(accounts),
        numOfAccounts: accounts.length,
      });
    } catch (err) {
      next(err);
    }
  };

  // [POST] account/exec-account
  executeAccount = async (req, res, next) => {
    try {
      const user = await Account.findById(req.query.id);
      const type = req.query.type;
      if (type == "ban") {
        user.accountStatus = "Banned";
      } else if (type == "unban") {
        if (user.requestStatus == "Become-seller") {
          user.accountStatus = "Pending";
        } else {
          user.accountStatus = "None";
          user.requestStatus = "None";
        }
      } else if (type == "accept") {
        user.accountStatus = "None";
        user.requestStatus = "None";
        user.role = "Seller";
      } else if (type == "deny") {
        user.accountStatus = "None";
        user.requestStatus = "None";
      } else {
        //type == remove
        if (user.requestStatus == "Become-seller") {
          user.accountStatus = "Pending";
        } else {
          user.accountStatus = "None";
          user.requestStatus = "None";
        }
      }
      await user.save();
      res.redirect("back");
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new acccountController();
