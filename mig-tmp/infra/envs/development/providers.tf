
provider "aws" {
  region = "ap-northeast-1"
  #  profile = "shunbun-development-admin-role"

  default_tags {
    tags = {
      Product     = "shunbun"
      Environment = "development"
      ManagedBy   = "terraform"
    }
  }
}
