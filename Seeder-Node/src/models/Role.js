const mongoose = require('mongoose');
require('./Permission');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },

    display: {
      type: String,
      required: [true, 'Role display name is required'],
      trim: true,
    },

    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;