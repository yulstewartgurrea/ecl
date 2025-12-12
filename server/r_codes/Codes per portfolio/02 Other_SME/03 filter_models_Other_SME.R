## IV. filter models

library(data.table)
library(pbapply)
library(tidyverse)

# clear the workspace
rm(list=ls())
gc()

portfolio = "Other_SME"
y_var = "CSB_ODR.logit"
num_vars_taken = 2

mfa_runs_w_cor = fread(paste0("Outputs/", portfolio, "/", portfolio,"_",num_vars_taken,"-var_combinations.csv"))



unfiltered_file_list <- list.files(
  path = paste0("Outputs/", portfolio, "/"),
  pattern = paste0("mfa_", y_var, "_", num_vars_taken, "-var_[0-9]{1,}\\.csv"),
  full.names = TRUE,
  recursive = TRUE
)

unfiltered_file_list


write_filtered_models = function(fn) {
  unfiltered_mfa = fread(fn)
  filtered_mfa = unfiltered_mfa %>% 
    left_join(mfa_runs_w_cor, by = paste0("X",1:num_vars_taken)) %>% 
    filter(max_abs_cor < 0.9, 
           R_Squared > 0.5, 
           MAPE < 0.5,
           if_all(starts_with("p-value"), ~ (.x < 0.1)),
           if_all(starts_with("vif"), ~ (.x < 10)), 
           if_all(starts_with("X"), ~ (str_detect(.x,".lag_")))) %>%
    arrange(desc(Adj_R_Squared)) 
  
  fwrite(filtered_mfa, paste0("Outputs/", portfolio, "/", "final", "/", portfolio, "_", "mfa_filtered_",y_var,"_",num_vars_taken,"-var.csv"), append=TRUE)
  gc()
  
  return(NULL)
}

return_container = pblapply(unfiltered_file_list, write_filtered_models)

