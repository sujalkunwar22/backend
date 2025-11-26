# Admin User Creation Script

This script helps you create the first admin user for the NepalAdvocate admin panel.

## Usage

### Default Admin (Quick Setup)
```bash
npm run create-admin
```

This will create an admin user with:
- **Email**: `admin@nepaladvocate.com`
- **Password**: `admin123`
- **Name**: Admin User

### Custom Admin
```bash
node scripts/createAdmin.js <email> <password> <firstName> <lastName>
```

Example:
```bash
node scripts/createAdmin.js admin@example.com MySecurePassword123 John Doe
```

## Important Notes

1. **Change Password**: After first login, change the default password immediately!
2. **Security**: Use a strong password in production
3. **Email Uniqueness**: The email must be unique - if an admin with that email exists, the script will fail

## First Login Credentials (Default)

If you run `npm run create-admin` without arguments:

- **Email**: `admin@nepaladvocate.com`
- **Password**: `admin123`

Access the admin panel at: `http://localhost:3000/admin`

