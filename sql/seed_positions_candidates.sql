USE secure_voting;

INSERT INTO positions (id, name, description) VALUES
  (1, 'Chairperson', 'Overall chair of the organization'),
  (2, 'Vice Chairperson', 'Deputy to the chairperson'),
  (3, 'Secretary', 'Records minutes and correspondence'),
  (4, 'Vice Secretary', 'Deputy to the secretary'),
  (5, 'Organizing Secretary', 'Coordinates events and logistics'),
  (6, 'Treasurer', 'Oversees finances'),
  (7, 'Chief Whip', 'Ensures attendance and discipline'),
  (8, 'Patron', 'Senior advisory role');

INSERT INTO candidates (position_id, full_name, alias) VALUES
  -- Chairperson (3)
  (1, 'Dr. Alice K. Morrow', 'Dr. A. K. Morrow'),
  (1, 'Mr. Benjamin R. Clarke', 'B. R. Clarke'),
  (1, 'Ms. Catherine L. Hughes', 'C. L. Hughes'),
  -- Vice Chairperson (2)
  (2, 'Mr. Daniel T. Ibrahim', 'D. T. Ibrahim'),
  (2, 'Ms. Evelyn J. Prior', 'E. J. Prior'),
  -- Secretary (2)
  (3, 'Mr. Francis D. Lowell', 'F. D. Lowell'),
  (3, 'Ms. Grace H. Ochieng', 'G. H. Ochieng'),
  -- Vice Secretary (1)
  (4, 'Ms. Hannah P. Sinclair', 'H. P. Sinclair'),
  -- Organizing Secretary (3)
  (5, 'Mr. Isaac K. Dunford', 'I. K. Dunford'),
  (5, 'Ms. Julia N. Mboya', 'J. N. Mboya'),
  (5, 'Mr. Kelvin S. Owuor', 'K. S. Owuor'),
  -- Treasurer (2)
  (6, 'Ms. Lydia R. Kamau', 'L. R. Kamau'),
  (6, 'Mr. Martin Q. Blake', 'M. Q. Blake'),
  -- Chief Whip (1)
  (7, 'Mr. Noah V. Barasa', 'N. V. Barasa'),
  -- Patron (2)
  (8, 'Prof. Oliver W. Njoroge', 'Prof. O. W. Njoroge'),
  (8, 'Dr. Patricia S. Langat', 'Dr. P. S. Langat');