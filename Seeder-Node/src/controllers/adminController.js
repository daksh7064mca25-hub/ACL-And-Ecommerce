const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const { sendPromotionEmail } = require('../services/emailService');

const SYSTEM_ROLES = ['Admin', 'Customer', 'Rider', 'Staff'];

/**
 * Get all registered Customers
 * GET /api/admin/users
 * Only returns users with the 'Customer' role.
 * Password hashes and verification tokens are excluded.
 */
const getCustomers = async (req, res) => {
  try {
    // 1. Find the 'Customer' role
    const customerRole = await Role.findOne({ name: 'Customer' });
    if (!customerRole) {
      return res.status(500).json({
        success: false,
        message: 'Customer role not configured in database',
      });
    }

    // 2. Query users where role is Customer, omitting sensitive fields
    const customers = await User.find({ role: customerRole._id })
      .select('name email isEmailVerified role createdAt')
      .populate('role', 'name display')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      users: customers,
    });
  } catch (error) {
    console.error('[AdminController - getCustomers Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer list. Please try again later.',
    });
  }
};

/**
 * Send promotional HTML email to selected Customers
 * POST /api/admin/promotions
 */
const sendPromotion = async (req, res) => {
  try {
    const { html, customerIds, subject } = req.body;

    // 1. Validate HTML content
    if (!html || typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Promotional HTML email content is required',
      });
    }

    // 2. Validate selected customerIds
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one customer to send the promotion to',
      });
    }

    // 3. Find Customer role to verify targets
    const customerRole = await Role.findOne({ name: 'Customer' });
    if (!customerRole) {
      return res.status(500).json({
        success: false,
        message: 'Customer role not found in database',
      });
    }

    // 4. Find all matching customers in database
    const customers = await User.find({
      _id: { $in: customerIds },
      role: customerRole._id,
    }).select('name email');

    if (customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid customers found for the selected IDs',
      });
    }

    // 5. Extract recipient email addresses
    const recipientEmails = customers.map((c) => c.email);

    // 6. Send the promotional email using the existing email service
    const emailResult = await sendPromotionEmail({
      recipients: recipientEmails,
      html: html.trim(),
      subject: subject?.trim() || 'Special Promotional Offer',
    });

    if (!emailResult.success && !emailResult.simulated) {
      return res.status(500).json({
        success: false,
        message: emailResult.error || 'Failed to dispatch promotional email',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Promotion sent successfully to ${recipientEmails.length} customer(s)`,
      sentCount: recipientEmails.length,
      simulated: Boolean(emailResult.simulated),
    });
  } catch (error) {
    console.error('[AdminController - sendPromotion Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while sending promotion. Please try again later.',
    });
  }
};

/**
 * Get current authenticated user's role and ACL permissions
 * GET /api/admin/me/permissions
 */
const getMyPermissions = async (req, res) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'User authentication or role missing',
      });
    }

    const roleName = req.user.role.name;
    const roleDisplay = req.user.role.display || roleName;
    const permissions = (req.user.role.permissions || []).map((p) => {
      if (typeof p === 'string') return p;
      return p.name;
    });

    return res.status(200).json({
      success: true,
      role: {
        name: roleName,
        display: roleDisplay,
      },
      permissions,
    });
  } catch (error) {
    console.error('[AdminController - getMyPermissions Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve permissions',
    });
  }
};

/**
 * Get all roles with populated permissions and active user counts
 * GET /api/admin/roles
 */
const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate('permissions', 'name display description')
      .sort({ createdAt: 1 });

    // Aggregate user count for each role
    const userCounts = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    userCounts.forEach((item) => {
      if (item._id) {
        countMap[item._id.toString()] = item.count;
      }
    });

    const rolesWithCounts = roles.map((role) => {
      const roleObj = role.toObject();
      return {
        ...roleObj,
        isSystemRole: SYSTEM_ROLES.includes(role.name),
        userCount: countMap[role._id.toString()] || 0,
      };
    });

    return res.status(200).json({
      success: true,
      roles: rolesWithCounts,
    });
  } catch (error) {
    console.error('[AdminController - getAllRoles Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve roles. Please try again later.',
    });
  }
};

/**
 * Get all available permissions in the system
 * GET /api/admin/permissions
 */
const getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ name: 1 });
    return res.status(200).json({
      success: true,
      permissions,
    });
  } catch (error) {
    console.error('[AdminController - getAllPermissions Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve permissions. Please try again later.',
    });
  }
};

/**
 * Create a new custom role with assigned permissions
 * POST /api/admin/roles
 */
const createRole = async (req, res) => {
  try {
    const { name, display, permissions } = req.body;

    // 1. Validate role name
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required',
      });
    }

    const trimmedName = name.trim();

    // 2. Check for duplicate role name (case-insensitive)
    const existingRole = await Role.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: `A role with the name '${trimmedName}' already exists`,
      });
    }

    // 3. Validate permissions array
    let permissionIds = [];
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      // Validate all IDs are valid ObjectIds
      const areValidIds = permissions.every((id) => mongoose.Types.ObjectId.isValid(id));
      if (!areValidIds) {
        return res.status(400).json({
          success: false,
          message: 'One or more permission IDs are invalid',
        });
      }

      // Verify that all permissions exist in database
      const foundPermissions = await Permission.find({ _id: { $in: permissions } });
      if (foundPermissions.length !== permissions.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected permissions do not exist',
        });
      }

      permissionIds = permissions;
    }

    // 4. Determine display name
    const trimmedDisplay = (display && typeof display === 'string' && display.trim()) || trimmedName;

    // 5. Create new role
    const newRole = await Role.create({
      name: trimmedName,
      display: trimmedDisplay,
      permissions: permissionIds,
    });

    const populatedRole = await Role.findById(newRole._id).populate(
      'permissions',
      'name display description'
    );

    return res.status(201).json({
      success: true,
      message: `Role '${trimmedName}' created successfully`,
      role: {
        ...populatedRole.toObject(),
        isSystemRole: false,
        userCount: 0,
      },
    });
  } catch (error) {
    console.error('[AdminController - createRole Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating role',
    });
  }
};

/**
 * Update an existing role and its permissions
 * PUT /api/admin/roles/:id
 */
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display, permissions } = req.body;

    // 1. Validate role ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format',
      });
    }

    // 2. Find existing role
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    const isSystemRole = SYSTEM_ROLES.includes(role.name);

    // 3. Update name if provided (prevent renaming system roles)
    if (name && typeof name === 'string' && name.trim()) {
      const trimmedName = name.trim();
      if (isSystemRole && trimmedName.toLowerCase() !== role.name.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: `System role identifier '${role.name}' cannot be renamed`,
        });
      }

      // Check uniqueness among other roles
      const duplicate = await Role.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `A role with the name '${trimmedName}' already exists`,
        });
      }

      role.name = trimmedName;
    }

    // 4. Update display if provided
    if (display && typeof display === 'string' && display.trim()) {
      role.display = display.trim();
    }

    // 5. Update permissions if provided
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: 'Permissions must be provided as an array of permission IDs',
        });
      }

      if (permissions.length > 0) {
        const areValidIds = permissions.every((pid) => mongoose.Types.ObjectId.isValid(pid));
        if (!areValidIds) {
          return res.status(400).json({
            success: false,
            message: 'One or more permission IDs are invalid',
          });
        }

        const foundPermissions = await Permission.find({ _id: { $in: permissions } });
        if (foundPermissions.length !== permissions.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more selected permissions do not exist',
          });
        }
      }

      role.permissions = permissions;
    }

    await role.save();

    const populatedRole = await Role.findById(role._id).populate(
      'permissions',
      'name display description'
    );

    const userCount = await User.countDocuments({ role: role._id });

    return res.status(200).json({
      success: true,
      message: `Role '${role.name}' updated successfully`,
      role: {
        ...populatedRole.toObject(),
        isSystemRole,
        userCount,
      },
    });
  } catch (error) {
    console.error('[AdminController - updateRole Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating role',
    });
  }
};

/**
 * Safely delete a custom role
 * DELETE /api/admin/roles/:id
 */
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format',
      });
    }

    // 2. Find role
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    // 3. Prevent deleting protected system roles
    if (SYSTEM_ROLES.includes(role.name)) {
      return res.status(400).json({
        success: false,
        message: `System role '${role.name}' cannot be deleted as it is required for core application operations.`,
      });
    }

    // 4. Prevent deleting roles currently assigned to users
    const assignedUserCount = await User.countDocuments({ role: role._id });
    if (assignedUserCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role '${role.name}' because it is currently assigned to ${assignedUserCount} active user(s). Please reassign them first.`,
      });
    }

    // 5. Delete role
    await Role.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Role '${role.name}' deleted successfully`,
    });
  } catch (error) {
    console.error('[AdminController - deleteRole Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while deleting role',
    });
  }
};

module.exports = {
  getCustomers,
  sendPromotion,
  getMyPermissions,
  getAllRoles,
  getAllPermissions,
  createRole,
  updateRole,
  deleteRole,
};

