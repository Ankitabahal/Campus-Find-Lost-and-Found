CREATE DATABASE IF NOT EXISTS smart_lost_found CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_lost_found;

CREATE TABLE IF NOT EXISTS User (
 user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(100) NOT NULL,
 username VARCHAR(30) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 email VARCHAR(254) NOT NULL UNIQUE,
 phone_number VARCHAR(15),
 role VARCHAR(20) NOT NULL DEFAULT 'USER',
 college_or_department VARCHAR(120),
 account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Item_Report (
 item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 reporter_id INT UNSIGNED NOT NULL,
 report_type VARCHAR(10) NOT NULL,
 item_name VARCHAR(100) NOT NULL,
 category VARCHAR(50) NOT NULL,
 description VARCHAR(1000) NOT NULL,
 item_date DATE NOT NULL,
 location VARCHAR(200) NOT NULL,
 image_url VARCHAR(2048),
 status VARCHAR(25) NOT NULL DEFAULT 'PUBLISHED',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_item_reporter FOREIGN KEY (reporter_id) REFERENCES User(user_id),
 CONSTRAINT chk_report_type CHECK (report_type IN ('LOST','FOUND'))
);

CREATE TABLE IF NOT EXISTS Claim (
 claim_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 item_id BIGINT UNSIGNED NOT NULL,
 claimant_id INT UNSIGNED NOT NULL,
 proof_details VARCHAR(1000) NOT NULL,
 proof_image_url VARCHAR(2048),
 claim_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
 admin_id INT UNSIGNED NULL,
 review_notes VARCHAR(1000),
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at DATETIME NULL,
 FOREIGN KEY (item_id) REFERENCES Item_Report(item_id),
 FOREIGN KEY (claimant_id) REFERENCES User(user_id),
 FOREIGN KEY (admin_id) REFERENCES User(user_id)
);

CREATE TABLE IF NOT EXISTS Match_Record (
 match_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 lost_item_id BIGINT UNSIGNED NOT NULL,
 found_item_id BIGINT UNSIGNED NOT NULL,
 match_score DECIMAL(5,2) NOT NULL DEFAULT 0,
 match_reason VARCHAR(500),
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY unique_pair (lost_item_id, found_item_id),
 FOREIGN KEY (lost_item_id) REFERENCES Item_Report(item_id),
 FOREIGN KEY (found_item_id) REFERENCES Item_Report(item_id)
);

CREATE TABLE IF NOT EXISTS Handover (
 handover_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 claim_id BIGINT UNSIGNED NOT NULL UNIQUE,
 handover_place VARCHAR(200) NOT NULL,
 handover_date DATETIME NULL,
 receiver_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
 finder_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
 handover_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
 notes VARCHAR(500),
 FOREIGN KEY (claim_id) REFERENCES Claim(claim_id)
);

CREATE TABLE IF NOT EXISTS Notification (
 notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 notification_type VARCHAR(30) NOT NULL,
 message VARCHAR(500) NOT NULL,
 delivery_status VARCHAR(20) NOT NULL DEFAULT 'SENT',
 is_read BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES User(user_id)
);
CREATE INDEX idx_item_search ON Item_Report(report_type, category, status, item_date);
CREATE INDEX idx_notification_user ON Notification(user_id, is_read, created_at);
