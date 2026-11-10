export function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Authentication required' });
  const allowedDuringPasswordChange = ['/me', '/change-password'].includes(req.path);
  if (req.session.user.mustChangePassword && !allowedDuringPasswordChange) {
    return res.status(403).json({ error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  next();
}
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
