const Evaluate = require("../models/evaluate.model");
const Account = require("../models/account.model");
const Product = require("../models/product.model");
const Order = require("../models/order.model");
const fs = require("fs");

const {
  mutipleMongooseToObject,
  mongooseToObject,
} = require("../utils/mongoose");
const { convertDate } = require("../helpers/handlebars");

class evaluateController {
  // [PUT] /specific-product/:id/report
  reportEvaluate = async (req, res, next) => {
    try {
      const evaluateId = req.params.id;
      await Evaluate.updateOne(
        { _id: evaluateId },
        { $set: { status: "reported" } }
      );
      res.redirect("back");
    } catch (error) {
      res.status(500).json({ error: "Lỗi khi lấy tất cả sản phẩm 1" });
    }
  };

  // [PUT] /specific-product/create
  createEvaluate = async (req, res, next) => {
    try {
      // const account = await Account.findOne({}); //***
      const idAccount = req.user._id; //***
      const cmtInput = req.body.cmtInput;
      const idProduct = req.params.id;

      // Tạo một đối tượng "evaluate" mới và lưu vào cơ sở dữ liệu
      const newEvaluate = new Evaluate({
        // idAccount: account._id,
        idAccount: idAccount,
        idProduct,
        content: cmtInput,
      });
      await newEvaluate.save();
      res.redirect("back");
    } catch (error) {
      next(error);
    }
  };

  // [GET] /sales-page/review
  showEvaluate = async (req, res, next) => {
    try {
      // const idAccount = await Account.findOne({}); //***
      let page = isNaN(req.query.page)
        ? 1
        : Math.max(1, parseInt(req.query.page));
      const limit = 4;

      const _idAccount = req.user._id; //***
      const evaluates = await Evaluate.find({ reply: "" })
        .populate({
          path: "idProduct",
          // match: { idAccount: _idAccount }, // Điều kiện kiểm tra trên idProduct
          populate: { path: "idAccount", match: { _id: _idAccount } },
        })
        .populate("idAccount");

      const filteredPopulatedData = evaluates.filter((item) => {
        // Kiểm tra điều kiện ở đây, ví dụ:
        return item.idProduct.idAccount !== null;
      });

      // evaluates = await evaluates.find({idProduct: {idAccount: {_id: _idAccount}}})
      // filteredPopulatedData.sort({ date: -1 })
      // .skip((page - 1) * limit)
      // .limit(limit);
      const sortedAndLimitedData = filteredPopulatedData
        .sort((a, b) => b.date - a.date) // Sắp xếp theo ngày giảm dần
        .slice((page - 1) * limit, page * limit); // Lấy phần giới hạn theo trang

      res.locals._numberOfItems = await Product.find().countDocuments();
      res.locals._limit = limit;
      res.locals._currentPage = page;

      res.locals.evaluates = mutipleMongooseToObject(sortedAndLimitedData);
      res.render("review-shop");
      // res.json(sortedAndLimitedData)
    } catch (error) {
      next(error);
    }
  };

  // [POST] /evaluate/review/:id/reply
  replyEvaluate = async (req, res, next) => {
    try {
      const idEvaluate = req.params.id;
      const replyShop = req.body.reply;
      await Evaluate.updateOne(
        { _id: idEvaluate },
        { $set: { reply: replyShop } }
      );
      res.redirect("back");
    } catch (error) {
      next(error);
    }
  };

  evaluateAndRating = async (req, res, next) => {
    try {
      // const { idAccount, idProduct, status, message, quantity } = req.body; // Giả sử dữ liệu được gửi qua body
      const accBuyer = await Account.findOne({ _id: req.user.id });
      const product = await Product.findOne({ _id: req.params._id });
      //   const order = await Order.findOne({ 'detail.idProduct': product._id })
      const order = await Order.findOne({
        idAccount: accBuyer._id,
        "detail.idProduct": product._id,
        "detail.isEvaluated": false,
      });
      const newEvaluate = new Evaluate({
        idAccount: accBuyer._id,
        idProduct: product._id,
        content: req.body.review,
        rating: req.body.rate,
      });

      order.detail.forEach((detailItem) => {
        if (detailItem.idProduct.equals(product._id)) {
          detailItem.isEvaluated = true;
        }
      });
      await newEvaluate.save(); // Lưu order mới vào MongoDB
      await order.save();
      res.redirect(`/account/my-order/${req.user.id}`);
      // res.status(201).json({ message: 'Đơn hàng đã được tạo thành công', order: savedOrder });
    } catch (err) {
      next(err);
    }
  };

  // [POST] /sales-page/:id/reply
  replyEvaluate = async (req, res, next) => {
    try {
      const idEvaluate = req.params.id;
      const replyShop = req.body.reply;
      await Evaluate.updateOne(
        { _id: idEvaluate },
        { $set: { reply: replyShop } }
      );
      res.redirect("back");
    } catch (error) {
      res.status(500).json({ error: "Lỗi khi lấy tất cả sản phẩm 1" });
    }
  };

  getAllEvaluate = async (req, res, next) => {
    try {
      let page = isNaN(req.query.page)
        ? 1
        : Math.max(1, parseInt(req.query.page));

      const limit = 10;
      const evaluate = await Evaluate.find({})
        .populate("idAccount")
        .populate({
          path: "idProduct",
          populate: { path: "idAccount" },
        })
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      const allEvaluate = mutipleMongooseToObject(evaluate);
      res.locals._numberOfItems = await Evaluate.find({}).countDocuments();
      res.locals._limit = limit;
      res.locals._currentPage = page;
      res.render("admin_comment_all", {
        convertDate: convertDate,
        evaluate: allEvaluate,
      });
    } catch (error) {
      next(error);
    }
  };

  getReportedEvaluate = async (req, res, next) => {
    try {
      let page = isNaN(req.query.page)
        ? 1
        : Math.max(1, parseInt(req.query.page));

      const limit = 10;
      const evaluate = await Evaluate.find({ status: "reported" })
        .populate("idAccount")
        .populate({
          path: "idProduct",
          populate: { path: "idAccount" },
        })
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      const allEvaluate = mutipleMongooseToObject(evaluate);
      res.locals._numberOfItems = await Evaluate.find({
        status: "reported",
      }).countDocuments();
      res.locals._limit = limit;
      res.locals._currentPage = page;
      res.render("admin_comment_reported", {
        convertDate: convertDate,
        evaluate: allEvaluate,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteEvaluate = async (req, res, next) => {
    try {
      const idEvaluate = req.query.id;
      const evaluate = await Evaluate.findById(idEvaluate);
      const remove = await Evaluate.deleteOne({ _id: idEvaluate });
      res.redirect("back");
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new evaluateController();
