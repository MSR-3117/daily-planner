const { body, query, validationResult } = require('express-validator');

/**
 * Common middleware to format and return validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: errors.array()[0].msg,
            errors: errors.array()
        });
    }
    next();
};

/**
 * Validation rules for Auth endpoints
 */
const validateRegister = [
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email format'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/[A-Za-z]/)
        .withMessage('Password must contain at least one letter')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number'),
    body('name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Name must be under 100 characters'),
    handleValidationErrors
];

const validateLogin = [
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email format'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    handleValidationErrors
];

/**
 * Validation rules for Task endpoints
 */
const validateDateQuery = [
    query('date')
        .isDate()
        .withMessage('Date must be in YYYY-MM-DD format'),
    handleValidationErrors
];

const validateTaskCreate = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ max: 200 })
        .withMessage('Title must be under 200 characters'),
    body('due_date')
        .isDate()
        .withMessage('Valid due_date is required in YYYY-MM-DD format'),
    body('scheduled_time')
        .optional({ nullable: true, checkFalsy: true })
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('scheduled_time must be in HH:MM format'),
    body('priority')
        .optional()
        .isIn(['high', 'medium', 'low'])
        .withMessage('priority must be high, medium, or low'),
    body('status')
        .optional()
        .isIn(['todo', 'done'])
        .withMessage('status must be todo or done'),
    body('recurrence')
        .optional({ nullable: true })
        .isIn(['daily', 'weekly', 'monthly'])
        .withMessage('Invalid recurrence pattern'),
    body('recurrence_end')
        .optional({ nullable: true })
        .isDate()
        .withMessage('recurrence_end must be a valid date'),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Category must be under 50 characters'),
    body('notes')
        .optional({ nullable: true })
        .trim(),
    handleValidationErrors
];

const validateTaskUpdate = [
    body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Title cannot be empty')
        .isLength({ max: 200 })
        .withMessage('Title must be under 200 characters'),
    body('due_date')
        .optional()
        .isDate()
        .withMessage('Valid due_date is required in YYYY-MM-DD format'),
    body('scheduled_time')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
            if (value === null || value === '') return true;
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        })
        .withMessage('scheduled_time must be in HH:MM format or null'),
    body('priority')
        .optional()
        .isIn(['high', 'medium', 'low'])
        .withMessage('priority must be high, medium, or low'),
    body('status')
        .optional()
        .isIn(['todo', 'done'])
        .withMessage('status must be todo or done'),
    body('recurrence')
        .optional({ nullable: true })
        .isIn(['daily', 'weekly', 'monthly'])
        .withMessage('Invalid recurrence pattern'),
    body('recurrence_end')
        .optional({ nullable: true })
        .isDate()
        .withMessage('recurrence_end must be a valid date'),
    body('category')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 50 })
        .withMessage('Category must be under 50 characters'),
    body('notes')
        .optional({ nullable: true })
        .trim(),
    handleValidationErrors
];

module.exports = {
    validateRegister,
    validateLogin,
    validateDateQuery,
    validateTaskCreate,
    validateTaskUpdate
};
