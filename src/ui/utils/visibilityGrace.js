/**
 * @file visibilityGrace.js
 * Bộ lọc chống báo giả (Grace Period) cho sự kiện visibilitychange.
 *
 * Khi người dùng rời khỏi tab, không phạt ngay lập tức.
 * Chờ 3–5 giây trước khi gọi callback phạt.
 * Nếu người dùng quay lại trong thời gian đó, hủy bỏ — không tính vi phạm.
 *
 * Mỗi lần rời ứng dụng chỉ tính tối đa 1 vi phạm (đặt cờ _penaltyIssuedThisSession).
 */

/** Thời gian grace period tối thiểu (ms) */
const GRACE_MIN_MS = 3000;
/** Thời gian grace period tối đa (ms) */
const GRACE_MAX_MS = 5000;

let _graceTimer = null;
let _penaltyIssuedThisSession = false;

/**
 * Trả về thời gian ngẫu nhiên trong khoảng GRACE_MIN_MS – GRACE_MAX_MS.
 * @returns {number}
 */
function _randomGraceMs() {
  return Math.floor(Math.random() * (GRACE_MAX_MS - GRACE_MIN_MS + 1)) + GRACE_MIN_MS;
}

/**
 * Bắt đầu grace period.
 * Gọi hàm này khi document.visibilityState === 'hidden'.
 *
 * @param {Function} onViolation - Hàm được gọi nếu người dùng không quay lại trong thời gian grace.
 */
export function startGracePeriod(onViolation) {
  // Nếu đã phát vi phạm trong phiên nền này rồi thì không phạt thêm
  if (_penaltyIssuedThisSession) return;

  // Hủy bộ đếm cũ nếu có (tránh ghi đè)
  cancelGracePeriod();

  _graceTimer = setTimeout(() => {
    _graceTimer = null;
    _penaltyIssuedThisSession = true; // Chỉ ghi nhận 1 lần mỗi phiên nền
    if (typeof onViolation === 'function') {
      onViolation();
    }
  }, _randomGraceMs());
}

/**
 * Hủy grace period.
 * Gọi hàm này khi người dùng quay lại (document.visibilityState === 'visible').
 * Cũng reset cờ để phiên nền tiếp theo có thể bắt đầu mới.
 */
export function cancelGracePeriod() {
  if (_graceTimer !== null) {
    clearTimeout(_graceTimer);
    _graceTimer = null;
  }
  // Reset cờ vi phạm khi người dùng đã quay lại
  _penaltyIssuedThisSession = false;
}

/**
 * Kiểm tra xem grace period có đang chạy hay không.
 * @returns {boolean}
 */
export function isGracePeriodActive() {
  return _graceTimer !== null;
}
