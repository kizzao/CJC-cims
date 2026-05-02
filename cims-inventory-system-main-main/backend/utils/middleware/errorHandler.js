const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // PostgreSQL errors
  if (err.code === '23505') {
    return res.status(409).json({ 
      error: 'Duplicate entry',
      detail: err.detail 
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({ 
      error: 'Referenced record not found',
      detail: err.detail 
    });
  }

  if (err.code === 'P0001') {
    return res.status(400).json({ 
      error: err.message 
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error',
      details: err.message 
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler };