const Evaluate = require('../models/evaluate.model');
const Account = require('../models/account.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const fs = require('fs');

const {
	mutipleMongooseToObject,
	mongooseToObject,
} = require('../utils/mongoose');

class evaluateController {
	// [PUT] /specific-product/:id/report
	reportEvaluate = async (req, res, next) => {
		try {
			const evaluateId = req.params.id;
			await Evaluate.updateOne({ _id: evaluateId }, { $set: { status: 'reported' } });
			res.redirect('back');

		} catch (error) {
			res.status(500).json({ error: 'Lỗi khi lấy tất cả sản phẩm 1' });
		}
	};
	// [PUT] /specific-product/create
	createEvaluate = async (req, res, next) => {
		try {
			const idAccount = await Account.findOne({}); //***
			const cmtInput = req.body.cmtInput
			const idProduct = req.params.id

			// Tạo một đối tượng "evaluate" mới và lưu vào cơ sở dữ liệu
			const newEvaluate = new Evaluate({
				idAccount,
				idProduct,
				content: cmtInput
			});
			await newEvaluate.save();

			// console.log()
			// res.status(200).json(newEvaluate);
			res.redirect('back');
		} catch (error) {
			res.status(500).json({ error: 'Lỗi khi lấy tất cả sản phẩm 1' });
		}
	};

	evaluateAndRating = async (req, res, next) => {
		try {
		  // const { idAccount, idProduct, status, message, quantity } = req.body; // Giả sử dữ liệu được gửi qua body
		  const accBuyer = await Account.findOne({_id: req.user.id})
		  const product = await Product.findOne({ _id: req.params._id })
		  console.log(req.params._id);
		//   const order = await Order.findOne({ 'detail.idProduct': product._id })
		  const order = await Order.findOne({
			idAccount: accBuyer._id,
			'detail.idProduct': product._id
		  })

		//   const orders = await Order.find({idSeller: accountId})
		//   .populate('idAccount')
		//   .populate('detail.idProduct')
		  
		// console.log(req.params._id);
		//   const productID = product._id
		//   .populate('idAccount')
		  // const idProduct = req.params._id;
		  // const message = req.body.message;
		  // const quantity = 1;
		  // console.log(idProduct)
	  
		  // const product = await Product.findById(idProduct);
		//   const idSeller = product.idAccount;
	
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
		//   console.log(newEvaluate);
		  await newEvaluate.save(); // Lưu order mới vào MongoDB
		  await order.save();
		  res.redirect(`/account/my-order/${req.user.id}`);
		  // res.status(201).json({ message: 'Đơn hàng đã được tạo thành công', order: savedOrder });
		} catch (err) {
		  next(err);
		}
	  };

	// [GET] /sales-page/review
	showEvaluate = async (req, res, next) => {
		try {
			const idAccount = await Account.findOne({}); //***
			const evaluates = await Evaluate.find({idAccount: idAccount, reply: ""})
			.populate('idProduct')
			res.locals.evaluates = mutipleMongooseToObject(evaluates)
			// res.json(evaluates)
			// res.status(200).json({ error: 'thanh cong' });
			res.render('review-shop')
		} catch (error) {
			res.status(500).json({ error: 'Lỗi khi lấy tất cả sản phẩm 1' });
		}
	};

	// [POST] /sales-page/:id/reply
	replyEvaluate = async (req, res, next) => {
		try {
			const idEvaluate = req.params.id
			const replyShop = req.body.reply
			await Evaluate.updateOne({ _id: idEvaluate }, { $set: { reply: replyShop } });
			res.redirect('back');
		} catch (error) {
			res.status(500).json({ error: 'Lỗi khi lấy tất cả sản phẩm 1' });
		}
	};
}

module.exports = new evaluateController();
